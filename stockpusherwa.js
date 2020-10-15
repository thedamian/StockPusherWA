const express = require('express');
const port = process.env.PORT || 5011;
const path = require('path');
const morgan = require('morgan');
const helmet = require('helmet');
const fetch = require('node-fetch');
require('dotenv').config(); 
const iexapi1 = "https://cloud.iexapis.com/stable/stock/";
const iexapi2 = "/quote?token="+process.env.IEXAPIS;
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
var twilio = require('twilio');
var twilioSend = new twilio(accountSid, authToken);
//const VoiceResponse = require('twilio').twiml.VoiceResponse;
const MessagingResponse = twilio.twiml.MessagingResponse;
const low = require('lowdb');
const shortid = require('shortid')
const FileSync = require('lowdb/adapters/FileSync')
const db = low(new FileSync('stocks.json'))
db.defaults({ stocks: [] }).write();
const app = express();
const bodyParser = require('body-parser'); // to parse "POST"
const { log } = require('console');
app.use(bodyParser.urlencoded({ extended: false })); // Part of "parsing POST"
app.enable('trust proxy');

app.use(helmet());
app.use(morgan('tiny'));
app.use(express.json());
app.set('view engine', 'ejs');
app.set("views", path.join(__dirname, `/views`)); 

let Stocks = db.get('stocks').value();
console.log("current stocks",Stocks);


// front page
app.get('/',  (req, res) => {
    res.render("index");
});


// start our website.
  app.listen(port, () => {
    console.log(`Listening at http://localhost:${port}`);
  });


  /*
"stocksymbol": "AAPL",
      "price": 120.00,
      "listener": [
        {"phone":"+19545881459",
         "price": 120.00,
         "direction": "up"
        },
        {"phone":"+19546826960",
          "price": 130.00,
          "direction": "down"
         }
      ]
*/

let TwillioReply = (messageText,res) => {
	    const response = new MessagingResponse(); 
            response.message(messageText);
            res.set('Content-Type', 'text/xml');
            res.end(response.toString());
}
let BadTwillioReply = (res) => {
    TwillioReply(`Invalid reply \nMessage should be {Symbol} {Price}\nExample:\nAAPL 120`,res);
}



//Receive a twilio noticifcaiton
app.post("/wamessage",async (req,res)=> {
    try {
        const updatetime = (new Date()).toLocaleTimeString();
        const response = new MessagingResponse(); 
        const text = req.body.Body.trim();
        const phone = req.body.From;
        console.log("Receive the following string: "+ text +" from phone: "+phone);

        if (text.indexOf(" ") == -1)  {
            BadTwillioReply(res); 
	    console.log("Reply had no space");
            return;
        }
        let messageArray = text.split(" ");
        if (messageArray.length != 2) {
            BadTwillioReply(res); 
	    console.log("request had more than two words");
            return;
        }
        stockSymbol = messageArray[0];
        stockPrice = messageArray[1];
        if (isNaN(stockPrice)) {
            BadTwillioReply(res);
            console.log("Request price was not a number");
            return;
        }
        let StockRealPrice = 0.00;
        try {
            StockRealPrice = await getPrice(stockSymbol);
        } catch(ex) {

            console.log("request stock symbol was invalid as "+ stockSymbol);
            TwillioReply(`Invalid stock Symbol \nMessage should be {Symbol} {Price}\nExample:\nAAPL 120`,res);
            return;
        }
        let alreadythere = false;
        Stocks = Stocks.map(s=> {
            if (s.stocksymbol == stockSymbol) {
                alreadythere = true;
                let newListener = {"phone":phone,
                "price": stockPrice
               };
                s.listener.push(newListener);
                db.get('stocks').update({"stocksymbol": stockSymbol}).assign({"listener":s.listener}).write();
            }
            return s;
        });
        if (!alreadythere) {
            let newStock = {"stocksymbol": stockSymbol,
            "price": StockRealPrice,
            "listener": [
                {"phone":phone,
                "price": stockPrice
                }]};
            Stocks.push(newStock);
                db.get('stocks')
                .push(newStock)
                .write()
        }

	TwillioReply(`Stock Added. \nYou'll be notified if ${stockSymbol} goes past ${stockPrice}. It's currently at ${StockRealPrice}`,res);

    } catch (ex) {
	console.log(ex);
        BadTwillioReply(res); 
        return;
    }
});


let getPrice = async (stocksymbol) =>  {
    let headers =  { 'Content-Type': 'application/json'};
    return await fetch(iexapi1+stocksymbol+iexapi2,{headers:headers})
    .then(res => res.json())
    .then(json => json.latestPrice);
}

let SendWhatsApp = async (phoneNbr,messageText) => {
    let twilioMsg = await twilioSend.messages
    .create({
       body: messageText,
       from: 'whatsapp:+14155238886',
       to: `whatsapp:${phoneNbr}`
     });
     return twilioMsg.sid;
}

/*
"stocksymbol": "AAPL",
      "price": 120.00,
      "listener": [
        {"phone":"+19545881459",
         "price": 120.00,
         "direction": "up"
        },
        {"phone":"+19546826960",
          "price": 130.00,
          "direction": "down"
         }
      ]
*/

let CheckStockPrices = async () => {
     Promise.all( await Stocks.map(async stock=> {
        let stockPrice = await getPrice(stock.stocksymbol);
        if (stockPrice != stock.price)
        {
            let directionUp =  Math.trunc(stockPrice) > Math.trunc(stock.price) ? true : false;
            console.log(`The currect price of ${stock.stocksymbol} is ${stockPrice} (was ${stock.price})  at ${new Date()}`);
            let newListeners = [];
             await stock.listeners?.map(async listener=> {
                if (
                    (listener.price < stockPrice && directionUp && listener.hit == false) || 
                    (listener.price >  stockPrice && !directionUp && listener.hit == false) 
                    ){
                    console.log("listener:",listener);
                    listener.hit = true;

                    // Send message to listener
                    let sid = await SendWhatsApp(listener.phone,`The currect price of ${stock.stocksymbol} is ${stockPrice} (was ${stock.price})  on ${new Date()}`);
                    console.log("sent whatsapp: " + sid);
                }
                newListeners.push(listener);
            });
            db.get('stocks').update({"stocksymbol": stock.stocksymbol}).assign({"listener":newListeners}).write();
            stock.price = stockPrice;
        }
       return stock

    })).then(updatedStocks => {

        Stocks = updatedStocks;
        console.log("damian");
        console.log("Stocks",Stocks);
        console.log("listeners",Stocks[0].listeners);
    });

}


//Check every 5 minutes
let Internal = 5 * 60 *1000; // 5 minutes
setInterval(CheckStockPrices,Internal);
CheckStockPrices(); // hit it once

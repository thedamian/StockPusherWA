# Stock Pusher WhatsAPP

Polls every 5 minutes. 
if your stock is higher or lower (you tell me) then I send you a whatsapp message with the notification.

# What service api keys you'll need.
- Get a developer key from [IexCloud](https://iexcloud.io/) and add it to your .env file
- get a developer TWILIO Account ID and AUTH TOKEN from [Twilio.com](https://www.twilio.com/referral/XOGfeb) (Free $20 from that link) and add it to your .env file

## To run it just:
- rename .env.example to .env 
- Enter your iexcloud and twillio keys in your new .env file
- npm i
- npm start

## To try the WhatsApp intergration
- Push the app to any cloud/server available online or use [localhost.run](https://localhost.run) to get your local computer up on the internet.
- Go to your [Twilio WhatsApp sandbox page](https://www.twilio.com/console/sms/whatsapp/sandbox) and enter url above with /wamessage at the end  in the `WHEN A MESSAGE COMES IN` section.
- Follow the "join xxxx-yyyy" message in that same page and then send a message like 'AAPL 120' to the phone number listed.

Enjoy!

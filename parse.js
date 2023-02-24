const {
	bot, 
	token
} = require('./core.js');

const inlineKeyboard = require('./inlineKeyboard');

const axios = require('axios');
const cheerio = require('cheerio');
const download = require('download');
const { get } = require('http');
const path = require('path');

const fs = require('fs');

const {ParseQueueShema} = require('./models');

function getPicsFromJoyreactorSuicideGirls() {

    const parseLink = 'https://joyreactor.cc/tag/suicide+girls'

    axios.get(parseLink).then( html => {
    
        const $ = cheerio.load(html.data);

        $('.postContainer .image a').each( (i, item) => {

            let itemLink = $(item).prop('href');

            let fileName = itemLink.split('/').pop(); 

            download('https:' + itemLink, path.join(__dirname, './parsePic/joyReactorSuicideGirls'), {
                filename: fileName
            }).then( () => {
                ParseQueueShema.create({
                    name: fileName,
                    type: 'joyReactorSuicideGirls',
                    path: '/parsePic/joyReactorSuicideGirls'
                }).catch( e => console.log('не удалось спарсить пикчу: ', e) );
            } )
                 
        } )

    })

};

function getPicsFromParseLib(type, chatId) {

    ParseQueueShema.findAll({
        where: {
            type: type
        }
    }).then( data => {

        data.forEach( item => {

            bot.sendPhoto(chatId, fs.createReadStream(path.join(__dirname + item.path + '/' + item.name)), {
                reply_markup: {
                    inline_keyboard: inlineKeyboard.parseOpenPic
                }
            })

        } )

    } )

}

module.exports = {getPicsFromJoyreactorSuicideGirls, getPicsFromParseLib};

 







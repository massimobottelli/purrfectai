// PurrfectAI
// Answers, purr-sonalized for you
const express = require('express');
const app = express();
const port = 3000;

const moment = require('moment');
const fs = require('fs');
const https = require('https');

let history = [];
let chat = '';

function createLogFile() {
// Create an empty csv file with the current date and time as the name
const now = moment();
const fileName = "log/" + now.format('YYYYMMDD_HHmmss') + '.csv';

fs.writeFile(fileName, '', function(err) {
    if (err) {
      console.log(err);
    };
  });
  return fileName;
}
 
function writeToCsv(text, fileName) {
    // Append timestamp and string to the file
    const now = moment();
    const timestamp = now.format('YYYY-MM-DD HH:mm:ss');
    const stringToAppend = `${timestamp},"${text}"\n`;
    fs.appendFile(fileName, stringToAppend, function(err) {
        if (err) {
            console.log(err);
        };
    });
}

// initialize OpenAI API
const {
    Configuration,
    OpenAIApi,
} = require('openai');
const readlineSync = require('readline-sync');
require('dotenv').config();

const configuration = new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// initialize parser for submitted data
const bodyParser = require('body-parser');
const {
    resolve
} = require('path');
app.use(bodyParser.urlencoded({
    extended: true
}));

// Set Pug as the view engine
app.set('view engine', 'pug');

// Serve the static files in the public directory
app.use(express.static('public'));

function clearChat() {
    history = [];
    chat = [];
}

function getMessagesAndAddToHistory(user_input) {
    const messages = [];
    for (const [input_text, completion_text] of history) {
        messages.push({
            role: 'user',
            content: input_text,
        });
        messages.push({
            role: 'assistant',
            content: completion_text,
        });
    }

    messages.push({
        role: 'user',
        content: user_input,
    });

    return messages;
}

async function processUserInput(user_input, res) {
    console.log(user_input); // debug

    if (user_input === '') {
        // empty page
        res.render('index', {});
    } else {
        // add user input to log file 
        writeToCsv (user_input, fileName);

        const messages = getMessagesAndAddToHistory(user_input);
        const completion = await openai.createChatCompletion({
            model: 'gpt-3.5-turbo',
            messages,
        });

        const completion_text = completion.data.choices[0].message.content;
        history.push([user_input, completion_text]);

        console.log(completion_text); // debug

        // add user input to log file 
        writeToCsv (completion_text, fileName);


        // Add question and answer to chat
        chat += `<div class="question"><p>${user_input}</p></div>`;
        chat += `<div class="answer"><p>${completion_text}</p></div>`;

        chat = chat.replace(/\n/g, '<br>');

        // format source code in answer
        while (chat.indexOf('```') > 0) {
            const firstIndex = chat.indexOf('```');
            const secondIndex = chat.indexOf('```', firstIndex + 1);

            if (firstIndex !== -1 && secondIndex !== -1) {
                const before = chat.substring(0, firstIndex);
                let code = chat.substring(firstIndex + 3, secondIndex);
                const after = chat.substring(secondIndex + 3);

                code = code.replace(/<br>/g, '\n');
                code = code.replace(/</g, '&lt;');
                code = code.replace(/>/g, '&gt;');

                chat = `${before}<pre><code>${code}</code></pre>${after}`;
            }
        }

        // render chat in frontend
        res.render('index', {
            content: chat
        });
    }
}

// Render the home page 
app.get('/', (req, res) => {
    res.render('index');
    fileName = createLogFile();
});

// Handle clear history
app.post('/clear', (req, res) => {
    clearChat();
    res.render('index');
    fileName = createLogFile();
    console.log('\nChat reset'); // debug
});

// Handle download
app.post('/download', (req, res) => {

    console.log('\nDownload Log'); // debug
    console.log(chat);

});

// Handle the form submission 
app.post('/', (req, res) => {
    const user_input = req.body.prompt;
    processUserInput(user_input, res);
});

// Start the server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});
import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import sqlite3 from "sqlite3";
import { selfKarmaMessages } from './selfKarmaMessages.js';

const db = new sqlite3.Database('karmadb.sqlite');
const token = process.env.T_API_TOKEN;
const bot = new TelegramBot(token, { polling: true });


bot.on('message', async (msg) => {
    if (!msg.text) return;
    // If too much time has passed ignore the message
    // Helps to prevent spamming the channel with tons of updates
    // also useful for clearing message queue if there are breaking errors
    const timeOut = .5; // timeout in minutes
    const messageDate = new Date(msg.date * 1000); // convert seconds to milliseconds
    const now = new Date();
    const elapsedTime = now - messageDate;
    const elapsedTimeInMinutes = elapsedTime / 60000;
    console.log(messageDate, now, elapsedTimeInMinutes, timeOut);
    
    if (elapsedTimeInMinutes > timeOut) {
        return;
    }

    console.log("checking command", msg.text.toString());

    const command = checkCommand(msg);
    console.log("Command is: " + command);

    switch (command) {
        case false:
            return;
        case "karma":
            processKarma(msg);
            console.log("Karma");
            break;
        case "hi":
            processHi(msg);
            console.log("Hi");
            break;
        case "help":
            processHelp(msg);
            console.log("Help!");
            break;
        case "karmaStats":
            processKarmaStats(msg);
            console.log("KarmaStats");
            break;
        case "karmaleaders":
            processKarmaLeaders(msg);
            console.log("KarmaLeaders");
            break;
        case "karmaplus":
            processKarmaPlusOrMinus(msg, "plus");
            console.log("KarmaPlus");
            break;
        case "karmaminus":
            processKarmaPlusOrMinus(msg, "minus");
            console.log("KarmaMinus");
            break;
        default:
            return
    }
    return;
});



/**
 * Given a Telegram message, returns a string indicating which command the message is:
 * 'karma', 'karmaStats', 'help', or 'hi'. If the message does not contain a valid
 * command, returns false.
 *
 * Supported commands are:
 * - karma: any message that contains '++', '--', or '—' in any word
 * - karmaStats: messages that start with '!karma' followed by a name
 * - help: messages that start with '!help'
 * - hi: messages that start with 'hi'
 *
 * @param {Object} msg - a Telegram message
 * @returns {string | false} - the command type or false if no command was found
 */
function checkCommand(msg) {
    const message = msg.text.toString();
    const words = message.split(" ");

    // Check for karma
    const karmaTest = words.find(word => word.endsWith("++") || word.endsWith("--") || word.endsWith("—"));
    if (karmaTest) {
        return "karma";
    }

    // Check for karmaStats
    if (words[0] === "!karma" && words[1].length > 0) {
        return "karmaStats";
    }

    // Check for help
    if (words[0].toLowerCase() === "!help") {
        return "help";
    }

    // Check for Hi command
    if (msg.text.toString().toLowerCase().indexOf("hi") === 0) {
        return "hi";
    }
    
    // Check for leaderboard command
    if (msg.text.toString().toLowerCase().indexOf("!karmaleaders") === 0) {
        return "karmaleaders";
    }

    // Check for Karma Plus or Minus command
    if (msg.text.toString().toLowerCase().indexOf("!karmaplus") === 0) {
        return "karmaplus";
    }
    if (msg.text.toString().toLowerCase().indexOf("!karmaminus") === 0) {
        return "karmaminus";
    }

    return false;
}

/**
 * Processes a karma message and updates the karma count for a specified user.
 * 
 * This function identifies the type of karma operation (addition or subtraction) 
 * from the message text and updates the user's karma record in the database. 
 * It also handles self-karma attempts by sending a humorous message to the user 
 * instead of updating the karma. The updated karma total is then sent back to 
 * the user in the chat.
 * 
 * @param {Object} msg - A Telegram message object containing the text of the message.
 */

async function processKarma(msg) {
    const messageText = msg.text.toString();
    console.log("Processing Karma message: ", msg);
    let karmaType = "";
    let karmaName = "";

    if (messageText.includes("++")) {
        karmaType = "plusplus";
    } else if (messageText.match(/--|—/)) {
        karmaType = "minusminus";
    }

    const messageArray = messageText.split(" ");
    if (messageArray.length > 1) {
        karmaName = messageArray.find(word => word.includes("++") || word.includes("--"));
    } else {
        karmaName = messageText;
    }

    karmaName = (karmaName ?? messageText).replace("++", "").replace("@", "").replace("--", "").replace("—", "");
    const karmaNameLower = karmaName.toLowerCase();

    if (checkSelfKarma(msg, karmaNameLower)) {
        const randomIndex = Math.floor(Math.random() * selfKarmaMessages.msgs.length);
        bot.sendMessage(msg.chat.id, selfKarmaMessages.msgs[randomIndex]);
        return;
    }


    // Add karma to the database
    // Insert or ignore a new record
    db.run('INSERT OR IGNORE INTO karma (name) VALUES (?)', [karmaNameLower]);

    // If the karmaType is "plusplus" then increment the plusplus field
    if (karmaType === 'plusplus') {
        db.run('UPDATE karma SET plusplus = COALESCE(plusplus, 0) + 1 WHERE name = ?', [karmaNameLower]);
    } else if (karmaType === 'minusminus') {
        db.run('UPDATE karma SET minusminus = COALESCE(minusminus, 0) + 1 WHERE name = ?', [karmaNameLower]);
    }

    const karma = await getKarma(karmaName);

    // handle possesive apostophes properly
    const reply =
        `${karma.karmaName}${karma.karmaName.toLowerCase().endsWith("s") ? "'" : "'s"} karma is now ${karma.karmaSum}`;
    bot.sendMessage(msg.chat.id, reply);
    return;
}

/**
 * Given a karmaName, returns the current state of the karma from the database
 * @param {string} karmaName - the name of the user to get the karma for
 * @returns {Promise<Object>} an object with the karmaName, plusplus, minusminus, and the sum of the two
 */
async function getKarma(karmaName) {
    const karmaNameLower = karmaName.toLowerCase();
    const row = await new Promise((resolve, reject) => {
        db.get('SELECT plusplus, minusminus FROM karma WHERE name = ?', [karmaNameLower], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });

    if (row) {
        console.log("Row is: ", row);

        return {
            karmaName: karmaName,
            plusplus: row.plusplus,
            minusminus: row.minusminus,
            karmaSum: row.plusplus - row.minusminus
        }
    } else {
        console.error('row is undefined');
        // handle the error
    }
}


/**
 * Returns the top 5 karma leaders from the database.
 * @returns {Promise<Object[]>} A promise that resolves to an array of objects with a name and karmaTotal property.
 * The objects are sorted in descending order by karmaTotal.
 */
async function getKarmaLeaders() {
    const rows = await new Promise((resolve, reject) => {
        db.all('SELECT name, plusplus - minusminus AS karmaTotal FROM karma ORDER BY karmaTotal DESC', (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
    return rows.slice(0, 5).map(row => ({
        name: row.name,
        karmaTotal: row.karmaTotal
    }));
}

/**
 * Returns the top 5 users with the most positive or negative karma.
 * @param {string} plusorMinus - if "plus" then returns the users with the most positive karma, if "minus" then returns the users with the most negative karma
 * @returns {Promise<Object[]>} A promise that resolves to an array of objects with a name and result property.
 * The objects are sorted in descending order by result.
 */
async function getKarmaPlusOrMinus(plusorMinus) {
    let query = "";
    if (plusorMinus === "minus"){
        query = 'SELECT name, minusminus AS result FROM karma ORDER BY minusminus DESC'
    }else {
        query = 'SELECT name, plusplus AS result FROM karma ORDER BY plusplus DESC'
    }

    const rows = await new Promise((resolve, reject) => {
        db.all(query, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
    return rows.slice(0, 5).map(row => ({
        name: row.name,
        result: row.result
    }));
}

function processHi(msg) {
    bot.sendMessage(msg.chat.id, "Hello");
}

/**
 * Process a help message by sending a help message with all the commands
 * that the bot knows.
 * @param {Object} msg - A Telegram message object containing the text of the message.
 */
function processHelp(msg) {
    console.log("Processing Help message");

    const reply =
        `I am a simple KarmaBot inspired by gal.

    The commands that I know are:

    [name]++    (add karma to [name])
    [name]--    (subtract karma from [name])
    !karma [name]    (get karma stats for [name])
    !karmaleaders    (get top 5 karma leaders)
    !karmaplus    (get top 5 most positive karma receivers)
    !karmaminus    (get top 5 most negative karma receivers)
    !help    (get help)`;
    console.log("Reply is: ", reply);

    bot.sendMessage(msg.chat.id, reply);
}

/**
 * Checks if the given karma name corresponds to the user who sent the message.
 *
 * This function determines whether the karma operation is a self-karma attempt
 * by comparing the username or first name of the message sender to the provided
 * karma name.
 *
 * @param {Object} msg - A Telegram message object containing the sender's information.
 * @param {string} karmaNameLower - The lowercase karma name to compare against the sender's name.
 * @returns {boolean} - True if the sender is trying to give karma to themselves, otherwise false.
 */

function checkSelfKarma(msg, karmaNameLower) {
    const userName = msg.from.username || msg.from.first_name;
    return userName.toLowerCase() === karmaNameLower;
}


/**
 * Process a karma stats message by sending karma stats for the user specified
 * in the message.
 *
 * This function takes a Telegram message object containing the text of the message
 * and sends a response with the karma stats of the user whose name is specified in
 * the message. If the user does not have any karma, a message is sent indicating
 * that they have not received any karma yet.
 *
 * @param {Object} msg - A Telegram message object containing the text of the message.
 */
async function processKarmaStats(msg) {
    let reply = "";
    let karmaName = msg.text.toString().split(" ")[1];
    karmaName = karmaName.replace("@", "");

    const karma = await getKarma(karmaName);
    console.log("karma is!!: ", karma);

    if (!karma) {
        console.error("Karma is undefined");
        bot.sendMessage(msg.chat.id, karmaName + " has not received karma yet.");
        return;
    }

    const plusplus = karma.plusplus;
    const minusminus = karma.minusminus;

    reply =
        `${karmaName} has received karma ${plusplus + minusminus} times.
${plusplus} positive karma and ${minusminus} negative karma.
For a total karma of ${plusplus - minusminus}.`;

    bot.sendMessage(msg.chat.id, reply);
}


/**
 * Process a karma leaders message by sending the top 5 most virtuous Telegram users.
 *
 * This function takes a Telegram message object containing the text of the message
 * and sends a response with the top 5 users with the highest total karma.
 *
 * @param {Object} msg - A Telegram message object containing the text of the message.
 */
async function processKarmaLeaders(msg){
    let reply = "These are the top 5 most virtuous Telegram users: \n\n";
    const topKarma = await getKarmaLeaders();
    reply += topKarma.map((karma, index) => `${index + 1}. ${karma.name}: ${karma.karmaTotal}`).join("\n");  
    bot.sendMessage(msg.chat.id, reply);
}

/**
 * Process a karma plus or minus message by sending the top 5 users with the most
 * positive or negative karma.
 *
 * This function takes a Telegram message object containing the text of the message
 * and sends a response with the top 5 users with the highest positive or negative
 * karma.
 *
 * @param {Object} msg - A Telegram message object containing the text of the message.
 * @param {string} plusOrMinus - if "plus" then returns the users with the most positive karma, if "minus" then returns the users with the most negative karma.
 */
async function processKarmaPlusOrMinus(msg, plusOrMinus){
    if(plusOrMinus === 'plus'){
        let reply = "These people received the most positive karma: \n\n";
        const topKarma = await getKarmaPlusOrMinus(plusOrMinus);
        reply += topKarma.map((karma, index) => `${index + 1}. ${karma.name}: ${karma.result}`).join("\n");  
        bot.sendMessage(msg.chat.id, reply);
    } else {
        let reply = "These people received the most negative karma: \n\n";
        const topKarma = await getKarmaPlusOrMinus(plusOrMinus);
        reply += topKarma.map((karma, index) => `${index + 1}. ${karma.name}: ${karma.result}`).join("\n");  
        bot.sendMessage(msg.chat.id, reply);
    }
}
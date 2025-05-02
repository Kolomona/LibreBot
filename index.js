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
    return false;
}

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


function processHi(msg) {
    bot.sendMessage(msg.chat.id, "Hello");
}

function processHelp(msg) {
    console.log("Processing Help message");

    const reply =
        `I am a simple KarmaBot inspired by gal.

    The commands that I know are:

    [name]++    (add karma to [name])
    [name]--    (subtract karma from [name])
    !karma [name]    (get karma stats for [name])
    !help    (get help)`;
    console.log("Reply is: ", reply);

    bot.sendMessage(msg.chat.id, reply);
}

function checkSelfKarma(msg, karmaNameLower) {
    const userName = msg.from.username || msg.from.first_name;
    return userName.toLowerCase() === karmaNameLower;
}


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


async function processKarmaLeaders(msg){

    let reply = "These are the top 5 most virtuous Telegram users: \n\n";


    const topKarma = await getKarmaLeaders();

    reply += topKarma.map((karma, index) => `${index + 1}. ${karma.name}: ${karma.karmaTotal}`).join("\n");  

    bot.sendMessage(msg.chat.id, reply);
}
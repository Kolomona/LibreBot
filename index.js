import 'dotenv/config';
import TelegramBot from 'node-telegram-bot-api';
import sqlite3 from "sqlite3";

const db = new sqlite3.Database('karmadb.sqlite');
const token = process.env.T_API_TOKEN;
const bot = new TelegramBot(token, { polling: true });


bot.on('message', async (msg) => {
    let karmaType = "none"
    const message = msg.text.toString();
    console.log(message);


    var Hi = "hi";
    if (msg.text.toString().toLowerCase().indexOf(Hi) === 0) {
        bot.sendMessage(msg.chat.id, "Hello");
    }


    // console.log("Message:", message);
    if (message.includes("++")) {
        karmaType = "plusplus";
        // console.log("plusplus ", karmaType);

    } else if (message.match(/--|—/)) {
        karmaType = "minusminus";
        // console.log("minusminus ", karmaType);
    }

    if (karmaType !== "none") {
        let karmaName = "";

        const messageArray = message.split(" ");
        if (messageArray.length > 1) {
            // get word that contains ++
            karmaName = messageArray.find(word => word.includes("++") || word.includes("--"));
        } else {
            karmaName = message;
        }

        karmaName = karmaName.replace("++", "").replace("@", "").replace("--", "").replace("—", "");

        const karma = await processKarma(karmaName, karmaType);

        // handle possesive apostophes properly
        const reply = `${karmaName}${karmaName.toLowerCase().endsWith("s") ? "'" : "'s"} karma is now ${karma}`;

        bot.sendMessage(msg.chat.id, reply);
    }
});


async function processKarma(name, karmaType) {
    console.log("Processing karmaType: ", karmaType);

    let karmaSum = 0;
    let plusplus = 0;
    let minusminus = 0;

    // Insert or ignore a new record
    await db.run('INSERT OR IGNORE INTO karma (name) VALUES (?)', [name]);

    // If the karmaType is "plusplus" then increment the plusplus field
    if (karmaType === 'plusplus') {
        db.run('UPDATE karma SET plusplus = COALESCE(plusplus, 0) + 1 WHERE name = ?', [name]);
    } else if (karmaType === 'minusminus') {
        db.run('UPDATE karma SET minusminus = COALESCE(minusminus, 0) + 1 WHERE name = ?', [name]);
    }

    // Get the values of the plusplus field and the minusminus field
    const row = await new Promise((resolve, reject) => {
        db.get('SELECT plusplus, minusminus FROM karma WHERE name = ?', [name], (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });

    plusplus = row.plusplus;
    minusminus = row.minusminus;
    karmaSum = plusplus - minusminus;

    return karmaSum;
}
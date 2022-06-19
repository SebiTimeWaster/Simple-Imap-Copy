#! /usr/bin/env node

/**
 * Simple-Imap-Copy v0.1 by TimeWaster
 *
 * Licensed under Creative Commons CC0 1.0 Universal
 *
 * Configure your mail servers below.
 * If your servers use special settings you can configure them following this documentation:
 * https://github.com/mscdex/node-imap#user-content-connection-instance-methods
 *
 * --- ✂ ------ ✂ ------ ✂ ------ ✂ ---
 */

const sourceAccountConfig = {
    user: 'user@host.tld',
    password: 'password',
    host: 'imap-server.tld',
    port: 993,
    tls: true,
};

const destinationAccountConfig = {
    user: 'user@host.tld',
    password: 'password',
    host: 'imap-server.tld',
    port: 993,
    tls: true,
};

const debug = false;

/**
 * --- ✂ ------ ✂ ------ ✂ ------ ✂ ---
 */

const Imap = require('imap');
const clc = require('cli-color');

const log = (text) => console.log(text);
const error = (text) => console.log(clc.redBright.bold(text));
const success = (text) => console.log(clc.greenBright(text));
const keepAliveConfig = { interval: 1000, forceNoop: true };

sourceAccountConfig.keepalive = keepAliveConfig;
destinationAccountConfig.keepalive = keepAliveConfig;

const srcServer = new Imap(sourceAccountConfig);
const destServer = new Imap(destinationAccountConfig);

const throwIt = (err, action) => {
    srcServer.destroy();
    destServer.destroy();

    error(`\n${err.message} (${action})`);

    if (debug) throw err;

    process.exit(1);
};

const closeConnections = () => {
    log(`\nAll done, closing connections`);

    srcServer.end();
    destServer.end();
};

const closeBox = (box, nextCallback) => {
    destServer.closeBox((err) => {
        if (err) throwIt(err);

        success(`Destination server: ${box.dest} closed`);

        srcServer.closeBox((err) => {
            if (err) throwIt(err);

            success(`Source server: ${box.src} closed`);

            nextCallback();
        });
    });
};

const copyBox = (box, nextCallback) => {
    srcServer.search(['ALL'], (err, results) => {
        if (err) throwIt(err, 'Source Server: Search Mails');

        if (!results || !results.length) {
            log('No emails found');
            closeBox(box, nextCallback);
            return;
        }

        let mailCount = results.length;

        log(`Emails to copy: ${mailCount}`);

        const fetch = srcServer.fetch(results, { bodies: '' });

        fetch.on('message', (msg, seqno) => {
            let email;
            let attrs;

            msg.on('body', (stream) => {
                stream.on('data', (chunk) => {
                    email += chunk.toString('utf8');
                });
            });

            msg.once('attributes', (attributes) => {
                attrs = attributes;
            });

            msg.once('end', () => {
                destServer.append(email, { date: new Date(attrs.date), flags: attrs.flags }, (err) => {
                    if (err) throwIt(err, 'Destination Server: Create Mail');

                    success(`Copied email No. ${seqno}`);

                    if (--mailCount === 0) {
                        closeBox(box, nextCallback);
                    }
                });
            });
        });

        fetch.once('error', (err) => throwIt(err, 'Source Server: Fetch Mail'));
    });
};

const openBox = (box, nextCallback) => {
    srcServer.openBox(box.src, true, (err) => {
        if (err) throwIt(err, 'Source Server: Open Box');

        success(`Source server: ${box.src} opened`);

        destServer.openBox(box.dest, false, (err) => {
            if (err) throwIt(err, 'Destination Server: Open Box');

            success(`Destination server: ${box.dest} opened`);

            copyBox(box, nextCallback);
        });
    });
};

const boxCallback = (box, nextCallback) => () => {
    log(`\nCopying ${box.src}`);

    if (box.create) {
        destServer.addBox(box.dest, (err) => {
            if (err) throwIt(err, 'Destination Server: Create Box');

            destServer.subscribeBox(box.dest, (err) => {
                if (err) throwIt(err, 'Destination Server: Subscribe Box');

                success(`Destination server: ${box.dest} was created`);

                openBox(box, nextCallback);
            });
        });
    } else {
        openBox(box, nextCallback);
    }
};

const parseBoxes = (boxes, delimiter, output = [], prefix = '') => {
    for (const [key, value] of Object.entries(boxes)) {
        const name = `${prefix}${key}`;

        output.push(name);

        if (value.children) parseBoxes(value.children, delimiter, output, `${name}${delimiter}`);
    }

    return output;
};

const loadBoxes = () => {
    log('\nLoad existing boxes');

    srcServer.getBoxes((err, srcBoxes) => {
        if (err) throwIt(err, 'Source Server: Load Boxes');

        success('Source server: Boxes loaded');

        destServer.getBoxes((err, destBoxes) => {
            if (err) throwIt(err, 'Destination Server: Load Boxes');

            success('Destination server: Boxes loaded');

            const srcBoxesParsed = parseBoxes(srcBoxes, srcServer.delimiter);
            const destBoxesParsed = parseBoxes(destBoxes, destServer.delimiter);
            const boxes = [];

            srcBoxesParsed.forEach((srcBox) => {
                const destBox = srcBox.replace(new RegExp(`[\\${srcServer.delimiter}]`, 'g'), destServer.delimiter);

                boxes.push({ src: srcBox, dest: destBox, create: destBoxesParsed.includes(destBox) ? false : true });
            });

            log('\nStart copying boxes');

            // node-imap does not expose the internal promises, make sure everything is executed in sequence
            let callbackChain = closeConnections;
            boxes.reverse().forEach((box) => {
                callbackChain = boxCallback(box, callbackChain);
            });
            callbackChain();
        });
    });
};

const connectServer = (server, name, callback) => {
    server.once('ready', () => {
        success(`${name} server: Connected`);

        callback();
    });
    server.once('error', (err) => throwIt(err, `${name} Server: Connect`));
    server.once('end', () => success(`${name} server: Disconnected`));
    server.connect();
};

try {
    log('Connecting to servers:');

    connectServer(srcServer, 'Source', () => connectServer(destServer, 'Destination', loadBoxes));
} catch (err) {
    throwIt(err, 'Unknown');
}

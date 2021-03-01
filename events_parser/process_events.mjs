
import { Account, Connection, PublicKey } from '@solana/web3.js';
import { Market, OpenOrders } from '@project-serum/serum';
import Database from 'better-sqlite3';

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const INFO_LEVEL = 'INFO';
const ERROR_LEVEL = 'ERROR';
const dbPath = path.join(__dirname, 'events.db');
const marketsPath = path.join(__dirname, 'markets.json');


var getDbEventStrings = function(num, marketMeta, db) {
    // most recent events are at the start of the event queue - so get most recent pull first, then order by id ascending
    let selectSql = 'SELECT raw_event FROM string_events where address = ? and programId = ? order by loadTimestamp desc, id asc limit ?'

    const rows = db.prepare(selectSql).all([marketMeta['address'], marketMeta['programId'], num]);

    return rows.map(r => r['raw_event']);
}

var getQueueOffset = function(events, marketMeta, db) {

    // So can't assume that there's a field that identifies an event uniquely (or combination of fields) - but we do know that the queue is fixed length and old events pop off the end
    // So how about pulling the event queue - storing it in an array - then checking that all events after a given index match the old event queue - then you have your new items

    let oldEventsStrings = getDbEventStrings(events.length, marketMeta, db);
    let newEventStrings = events.map(e => JSON.stringify(e));

    for (const [index, eventString] of newEventStrings.entries()) {

    
        if (eventString === oldEventsStrings[0]) {

            var match = true;
            for (var i = index; i < newEventStrings.length; i++) {
                if (newEventStrings[i] !== oldEventsStrings[i-index]) {
                    match = false;
                }
            }
    
            if (match = true) {
                var queueOffset = index;
                log('Events matching at offet ' + queueOffset, INFO_LEVEL, marketMeta);
                break;
            }
        }
    }

    if (!match) {
        log('Events not matching', ERROR_LEVEL, marketMeta);
    }

    return queueOffset;
    
}


var getOwner = async function(connection, openOrders, programID) {
    var o = await OpenOrders.load(connection, new PublicKey(openOrders), new PublicKey(programID));
    
    return o.owner.toString();
}


var addOwnerMappings = async function(events, db, connection, marketMeta) {

    let waitTime = 50;

    // unique openOrders
    let uniqueOpenOrders = events.map(e => e.openOrders.toString()).filter((item, i, ar) => ar.indexOf(item) === i);

    let selectSql = 'SELECT owner FROM owners WHERE openOrders = ?';
    let insertSql = 'INSERT INTO owners (openOrders, owner) VALUES (?, ?)'

    var multipleApiCalls = false;
    for (let openOrders of uniqueOpenOrders) {

        const row = db.prepare(selectSql).get(openOrders);
        
        let recordFound = !(row === undefined);

        if (!recordFound) {
            // If we're going to be hitting the API multiple times - wait a small amount of time between each call
            if (multipleApiCalls) { 
                await new Promise(resolve => setTimeout(resolve, waitTime));
            }
            
            try {
                // I have seen errors here from the api call - just log them for retrying later (priority is to insert events)
                let owner = await getOwner(connection, openOrders, marketMeta['programId']);
                log('Creating new owner record for ' + openOrders, INFO_LEVEL, marketMeta);
                db.prepare(insertSql).run(openOrders, owner);    
            } catch (error) {
                log('Error for openOrder: ' + openOrders + '. Error: ' + error.toString(), ERROR_LEVEL, marketMeta);
            }
            
            multipleApiCalls = true;
        } else {
            log('Owner record already exists for ' + openOrders, INFO_LEVEL, marketMeta);
        }
    };
}

var insertStringEvents = function(events, marketMeta, loadTimestamp, db) {

    let insertSQL = 'INSERT INTO string_events (address, programId, raw_event, parsed_event, loadTimestamp) values (?, ?, ?, ?, ?)'
        
    const insert = db.prepare(insertSQL);

    const insertEvents = db.transaction((events, marketMeta) => {
        for (const event of events) {
            insert.run(
                marketMeta['address'],
                marketMeta['programId'],
                JSON.stringify(event),
                // TODO: this should be shared with insertEvents - DRY
                JSON.stringify(
                    {
                        'fill': event.eventFlags['fill'] ? 1 : 0,
                        'bid': event.eventFlags['bid'] ? 1 : 0,
                        'out': event.eventFlags['out'] ? 1 : 0,
                        'maker': event.eventFlags['maker'] ? 1 : 0,
                        'openOrdersSlot': event.openOrdersSlot,
                        'feeTier': event.feeTier,
                        'nativeQuantityReleased': parseInt(event.nativeQuantityReleased.toString()),
                        'nativeQuantityPaid': parseInt(event.nativeQuantityPaid.toString()),
                        'nativeFeeOrRebate': event.nativeFeeOrRebate.toString(),
                        'orderId': event.orderId.toString(),
                        'openOrders': event.openOrders.toString(),
                        'clientOrderId': event.clientOrderId.toString()
                    }
                ),
                
                loadTimestamp
                );
            }
    });

    insertEvents(events, marketMeta);

    log('Inserted ' + events.length + ' events strings', INFO_LEVEL, marketMeta);

}

var insertEvents = async function(events, marketMeta, loadTimestamp, db) {

    let start = new Date();

    let insertSQL = `INSERT INTO events
        (address, programId, baseCurrency, quoteCurrency, fill, out, bid, maker, openOrdersSlot, feeTier, nativeQuantityReleased, nativeQuantityPaid, nativeFeeOrRebate, orderId, openOrders, clientOrderId, loadTimestamp)
        VALUES 
        (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

    const insert = db.prepare(insertSQL);

    const insertEvents = db.transaction((events, marketMeta) => {
        for (const event of events) {
            insert.run(
                marketMeta['address'],
                marketMeta['programId'],
                marketMeta['baseCurrency'],
                marketMeta['quoteCurrency'],
                event.eventFlags['fill'] ? 1 : 0,
                event.eventFlags['out'] ? 1 : 0,
                event.eventFlags['bid'] ? 1 : 0,
                event.eventFlags['maker'] ? 1 : 0,
                event.openOrdersSlot,
                event.feeTier,
                parseInt(event.nativeQuantityReleased.toString()),
                parseInt(event.nativeQuantityPaid.toString()),
                event.nativeFeeOrRebate.toString(),
                event.orderId.toString(),
                event.openOrders.toString(),
                event.clientOrderId.toString(),
                loadTimestamp
                );
            }
    });

    insertEvents(events, marketMeta);

    log('Inserted ' + events.length + ' events', INFO_LEVEL, marketMeta);

}



var insertCurrencyMeta = async function(marketMeta, db) {

    let row;
    let recordFound;

    let selectSql = 'SELECT currency FROM currency_meta WHERE address = ? and programId = ? and currency = ?';
    let insertSql = 'INSERT INTO currency_meta (address, programId, currency, MintDecimals) VALUES (?, ?, ?, ?)'

    row = db.prepare(selectSql).get(marketMeta['address'], marketMeta['programId'], marketMeta['baseCurrency']);
    recordFound = !(row === undefined);
    if (!recordFound) {
        log('inserting MintDecimals for ' + marketMeta['baseCurrency'], INFO_LEVEL, marketMeta);
        db.prepare(insertSql).run(marketMeta['address'], marketMeta['programId'], marketMeta['baseCurrency'], marketMeta['_baseSplTokenDecimals']); 
    }

    row = db.prepare(selectSql).get(marketMeta['address'], marketMeta['programId'], marketMeta['quoteCurrency']);
    recordFound = !(row === undefined);
    if (!recordFound) {
        log('inserting MintDecimals for ' + marketMeta['quoteCurrency'], INFO_LEVEL, marketMeta);
        db.prepare(insertSql).run(marketMeta['address'], marketMeta['programId'], marketMeta['quoteCurrency'], marketMeta['_quoteSplTokenDecimals']); 
    }
}

var log = function(message, level, marketMeta) {

    const db = new Database(dbPath);

    const timestamp = new Date().toISOString();

    db.prepare('insert into log (address, programId, message, level, timestamp) values (?, ?, ?, ?, ?)').run(marketMeta['address'], marketMeta['programId'], message, level, timestamp);

    console.log(message);
} 

var main = async function() {

    const db = new Database(dbPath);
    const waitTime = 50;

    var markets = JSON.parse(fs.readFileSync(marketsPath, 'utf8'));

    // Remove deprecated items
    markets = markets.filter((item, i, ar) => !item['deprecated']);

    for (var i = 0; i < markets.length; i++) {
        console.log(i);
        let marketMeta = markets[i];
        
        marketMeta['baseCurrency'] = marketMeta['name'].split('/')[0];
        marketMeta['quoteCurrency'] = marketMeta['name'].split('/')[1];
        
        let connection = new Connection('https://solana-api.projectserum.com/');
        let marketAddress = new PublicKey(marketMeta['address']);
        let programID = new PublicKey(marketMeta['programId']);

        // Contrary to the docs - you need to pass programID as well it seems
        let market = await Market.load(connection, marketAddress, {}, programID);

        marketMeta['_baseSplTokenDecimals'] = market._baseSplTokenDecimals
        marketMeta['_quoteSplTokenDecimals'] = market._quoteSplTokenDecimals

        console.log(marketMeta['name']);

        let loadTimestamp = new Date().toISOString();
        let events = await market.loadEventQueue(connection, 1000000);

        log('Pulling event queue at ' + loadTimestamp, INFO_LEVEL, marketMeta);

        let queueOffset = getQueueOffset(events, marketMeta, db);

        let newEvents = events.slice(0, queueOffset);

        await addOwnerMappings(newEvents, db, connection, marketMeta);
        insertCurrencyMeta(marketMeta, db);

        insertEvents(newEvents, marketMeta, loadTimestamp, db);
        insertStringEvents(newEvents, marketMeta, loadTimestamp, db);

        await new Promise(resolve => setTimeout(resolve, waitTime));

        
    }

}


await main();


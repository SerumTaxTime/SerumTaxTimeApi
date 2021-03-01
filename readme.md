```
cd events_parser
npm install @solana/web3.js @project-serum/serum
npm install better-sqlite3

// There is a bug in loadEventQueue in market.js - it uses count in the event queue header to determine how many events to parse
// But count is always zero (that I have seen)
// So replace loadEventQueue with the following to explicitly control the minimum number of events to parse 
async loadEventQueue(connection, numEvents) {
    const { data } = throwIfNull(await connection.getAccountInfo(this._decoded.eventQueue));
    return queue_1.decodeEventQueue(data, numEvents);
}

The script to create events_parser/events.db is events_parser/init_events.sql

To compile extension-functions.c
#### Mac
gcc -g -I. -fPIC -dynamiclib extension-functions.c -o extension-functions.dylib

#### Windows
gcc -shared -o extension-functions.dll extension-functions.c -I.

#### Linux
gcc -fPIC -shared -o extension-functions.so extension-functions.c -lm

```
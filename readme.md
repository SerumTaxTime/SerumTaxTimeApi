# Overview

Trades made on the Serum Dex are taxable. However, Serum does not store a history of trades - it is up to the user to record their trades as they make them. This is inconvenient and the user also faces the risk of inaccurately filing trades for tax purposes.

SerumTaxTime solves this problem by providing an extension to the standard Serum UI that allows users to export a history of their trades to csv. Furthermore, the csv is in a tax friendly format (compatible with the [Taxbit csv import specification](https://help.taxbit.com/hc/en-us/articles/360047756913-Importing-transactions-manually-with-a-CSV-file)).
An example of the Serum UI with the SerumTaxTime extension can be found at https://serumtaxtime.github.io/serum-dex-ui/.

A video walkthrough can be found [here](https://www.youtube.com/watch?v=yFexFkMLEBY).

# How does it work?
Trades processed by the matching engine are stored on the event queue for a particular market.

SerumTaxTime 
* periodically queries the event queue API
   * Currently queries 55 non deprecated markets (defined in event_parser/markets.json)
* parses the raw binary data into a human readable format
* stores the resulting data in a database
* serves an API that queries the database and transforms the results into a tax friendly format

SerumTaxTime also provides an extension to the Serum UI that adds a trade exporter tab to the trade page that queries the SerumTaxTime API and return trades made by the user to the UI interface for download.

# Installation
```
cd events_parser
npm install @solana/web3.js @project-serum/serum
npm install better-sqlite3

// There is a bug in loadEventQueue in @project-serum/serum/lib/market.js - it uses the count field in the event queue header to determine how many events to parse.
// But count is unreliable
// So replace loadEventQueue with the following to explicitly control the minimum number of events to parse 
async loadEventQueue(connection, numEvents) {
    const { data } = throwIfNull(await connection.getAccountInfo(this._decoded.eventQueue));
    return queue_1.decodeEventQueue(data, numEvents);
}
```
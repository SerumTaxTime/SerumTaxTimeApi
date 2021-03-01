BEGIN TRANSACTION;
DROP TABLE IF EXISTS "currency_meta";
CREATE TABLE IF NOT EXISTS "currency_meta" (
	"address"	TEXT,
	"programId"	TEXT,
	"currency"	TEXT,
	"MintDecimals"	INTEGER,
	PRIMARY KEY("currency","address","programId")
);
DROP TABLE IF EXISTS "owners";
CREATE TABLE IF NOT EXISTS "owners" (
	"openOrders"	TEXT,
	"owner"	TEXT,
	PRIMARY KEY("openOrders")
);
DROP TABLE IF EXISTS "string_events";
CREATE TABLE IF NOT EXISTS "string_events" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"address"	TEXT,
	"programId"	TEXT,
	"raw_event"	TEXT,
	"parsed_event"	INTEGER,
	"loadTimestamp"	TEXT
);
DROP TABLE IF EXISTS "log";
CREATE TABLE IF NOT EXISTS "log" (
	"address"	TEXT,
	"programId"	TEXT,
	"message"	TEXT,
	"level"	TEXT,
	"timestamp"	TEXT
);
DROP TABLE IF EXISTS "events";
CREATE TABLE IF NOT EXISTS "events" (
	"id"	INTEGER PRIMARY KEY AUTOINCREMENT,
	"address"	TEXT,
	"programId"	TEXT,
	"baseCurrency"	text,
	"quoteCurrency"	text,
	"fill"	INTEGER,
	"out"	INTEGER,
	"bid"	INTEGER,
	"maker"	INTEGER,
	"openOrdersSlot"	text,
	"feeTier"	text,
	"nativeQuantityReleased"	text,
	"nativeQuantityPaid"	text,
	"nativeFeeOrRebate"	text,
	"orderId"	text,
	"openOrders"	text,
	"clientOrderId"	text,
	"loadTimestamp"	TEXT
);
DROP INDEX IF EXISTS "currency_meta_1";
CREATE INDEX IF NOT EXISTS "currency_meta_1" ON "currency_meta" (
	"address",
	"programId",
	"currency"
);
DROP INDEX IF EXISTS "events_1";
CREATE INDEX IF NOT EXISTS "events_1" ON "events" (
	"openOrders",
	"address",
	"programId"
);
DROP INDEX IF EXISTS "owners_1";
CREATE INDEX IF NOT EXISTS "owners_1" ON "owners" (
	"owner"
);
COMMIT;

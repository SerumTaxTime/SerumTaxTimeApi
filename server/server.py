from flask import Flask, render_template, make_response, g, current_app, jsonify, request
from flask_cors import CORS
import os
import sqlite3
from sys import platform


def connect_db(db_name):
    """Connects to the specific database."""
    rv = sqlite3.connect(current_app.config[db_name], detect_types=sqlite3.PARSE_DECLTYPES)
    return rv


def get_events_db():
    """Opens a new database connection if there is none yet for the
    current application context.
    """
    if not hasattr(g, 'sqlite_db'):
        g.sqlite_db = connect_db('EVENTS_DATABASE')
    return g.sqlite_db


def create_app(debug=False):
    """Create an application."""
    app = Flask(__name__)
    app.debug = debug
    app.config['EVENTS_DATABASE'] = os.path.join(app.root_path, '..', 'events_parser', 'events.db')
    print(app.config['EVENTS_DATABASE'])

    print('debug mode: ' + str(app.debug))

    return app

app = create_app()
cors = CORS(app)


def get_transactions(owner_pubkey):
    db = get_events_db()

    db.enable_load_extension(True)
    extension_dir = os.path.abspath(os.path.join(current_app.root_path, 'sqlite_extensions'))

    if platform == "linux" or platform == "linux2":
        extension_path = os.path.join(extension_dir, 'extension-functions')
    elif platform == "darwin":
        extension_path = os.path.join(extension_dir, 'extension-functions')
    elif platform == "win32":
        extension_path = os.path.join(extension_dir, 'extension-functions.dll')

    db.execute(f"select load_extension('{extension_path}')")

    # FBdDyNVweUtApevXNGSCBjWnmBkU3gmgqnvyPXviQhYm
    sql = """
    select 
    t2.loadTimestamp as date_and_time,
    'trade' as transaction_type,
    case 
        when
            t2.bid = 1 then t2.nativeQuantityPaid / power(10, quote.MintDecimals)
        ELSE
            t2.nativeQuantityPaid / power(10, base.MintDecimals)
        end 
    as sent_quantity,
    case
        when
            t2.bid = 1 then t2.quoteCurrency
        ELSE
            t2.baseCurrency
        end 
    as sent_currency,
    'serum' as sending_source,
    case 
        WHEN
            t2.bid = 1 then t2.nativeQuantityReleased / power(10, base.MintDecimals)
        ELSE
            t2.nativeQuantityReleased / power(10, quote.MintDecimals)
        end
    as received_quantity,
    case
        when
            t2.bid = 1 then t2.baseCurrency
        ELSE
            t2.quoteCurrency
        end
    as received_currency,
    'serum' as receiving_destination,
    case when t2.maker = 1 then -1 else 1 end * t2.nativeFeeOrRebate / power(10, quote.MintDecimals) as fee,
    t2.quoteCurrency as fee_currency,
    null as exchange_transaction_id,
    null as blockchain_transaction_hash
    from 
    owners t1
    inner join events t2 on
        t2.openOrders = t1.openOrders
    inner join currency_meta quote on
        quote.currency = t2.quoteCurrency
        and quote.address = t2.address
        and quote.programId = t2.programId
    inner join currency_meta base on
        base.currency = t2.baseCurrency
        and base.address = t2.address
        and base.programId = t2.programId
    where t1.owner = ?
    and t2.fill = 1
    order by t2.loadTimestamp desc, t2.id asc
    limit 100
    """

    cur = db.execute(sql, [owner_pubkey])
    data = cur.fetchall()
    columns = [x[0] for x in cur.description]

    return data, columns

@app.route('/transactions_api', methods=['POST'])
def display_transactions():
    owner_pubkey = request.form['owner_pubkey']
    data, columns = get_transactions(owner_pubkey)

    # Format for dataTable
    json_data = [{c: v for c, v in zip(columns, r)} for r in data]

    return jsonify({'data': json_data, 'columns': columns})

@app.route('/')
def index():
    return render_template('index.html')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=80)
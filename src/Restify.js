import mysql from 'mysql';
import logger from './Logger';

const ONE_TO_ONE = 'OneToOne';
const ONE_TO_MANY = 'OneToMany';
const MANY_TO_ONE = 'ManyToOne';
const MANY_TO_MANY = 'ManyToMany';

/**
 * @class Restify
 * @param {Object} config - Configuration.
 * @param {Object} config.database - Database configuration.
 * @param {String} config.database.host - Host/IP.
 * @param {String} config.database.user - Username.
 * @param {String} config.database.pass - Password.
 * @param {String} config.database.db - Database name.
 * @param {Object} config.schema - Schema configuration.
 * @param {Object} config.schema.{collection} - Collection name.
 * @param {Object} config.schema.{collection}.{field} - Field name.
 * @param {Object} config.schema.{collection}.{field}.type - Data type.
 * @param {Boolean} config.schema.{collection}.{field}.nullable - Can be null.
 * @param {String} config.schema.{collection}.{field}.relation - Relation.
 * @param {String} config.schema.{collection}.{field}.as - Remote name.
 * 
 */
class Restify {
	
	constructor(config) {

		// read database configuration
		// and create mysql connection
		this._database = {
			host: config.database.host,
			user: config.database.user,
			pass: config.database.pass,
			db: config.database.db
		};

		this._collections = JSON.parse(JSON.stringify(config.schema));

		// add ID field and mark master relation
		for(let collectionName in this._collections) {
			let collection = this._collections[collectionName];
			
			collection._id = {
				type: 'int',
				nullable: 'false',
			};

			for(let fieldName in collection) {
				let field = collection[fieldName];

				if(field.nullable == null) {
					field.nullable = true;
				} 

				if(field.relation != null) {
					field.master = true;
				}
			}
		}

		for(let collectionName in this._collections) {
			let collection = this._collections[collectionName];

			for(let fieldName in collection) {
				let field = collection[fieldName];
				if(field.master) {
					this._collections[field.type][field.as] = {
						type: collectionName,
						nullable: false,
						relation: this.invRelation(field.relation),
						as: fieldName
					};
				}
			}
		}
	}

	/**
	 * Get a list of collections in the database.
	 * @function Restify#collections
	 * @return {Array<String>} List of collections
	 */
	collections() {
		return Object.keys(this._collections);
	}

	/**
	 * Get a list of fields for a given collection.
	 * @function Restify#fields
	 * @param  {String} collection - Collection to get the fields of.
	 * @return {Array<String>} List of fields in the given collection.
	 */
	fields(collection) {
		return Object.keys(this._collections[collection]);
	}

	connect() {
		return new Connection(this);
	}


	async reset() {	
		let conn = this.connect();

		let tableNameRecords = await conn.exec(this.stmtSelectTableName());
		await conn.exec(this.stmtSetForeignKeyCheck(false));
		for(let record of tableNameRecords) {
			await conn.exec(this.stmtDropTable(record.table_name));
		}
		await conn.exec(this.stmtSetForeignKeyCheck(true));

		await conn.end();
	}

	/**
	 * Sync database schema.
	 * @function Restify#sync
	 * @param  {Boolean} update - To update or not.
	 * @return {Promise<null>} 
	 */
	async sync(update) {
		let conn = this.connect();

		for(let collectionName of Object.keys(this._collections)) {
			await conn.exec(this.stmtCreateTable(collectionName));
		}

		await conn.end();
	}


	


	//========================================
	//	Private Functions
	//========================================
	invRelation(relation) {
		switch(relation) {
			case ONE_TO_ONE:
			case MANY_TO_MANY:
				return relation;
			case ONE_TO_MANY: 
				return MANY_TO_ONE;
			case MANY_TO_ONE:
				return ONE_TO_MANY;
			default:
				throw new Error(`Undefined relation ${relation}.`);
		}
	}

	escId(id) {	
		return this.conn.escapeId(id);
	}

	escVal(val) {
		return this.conn.escape(val);
	}

	
	//===============================
	//	SQL statements
	//===============================
	
	stmtCreateTable(table) {
		return `CREATE TABLE IF NOT EXISTS ${mysql.escapeId(table)} (`
			+ `id int, PRIMARY KEY(id)`
			+ `);`;
	}

	stmtSelectTableName() {
		return `SELECT table_name `
			+ `FROM information_schema.tables `
			+ `WHERE table_schema=${mysql.escape(this._database.db)};`;
	}

	stmtSetForeignKeyCheck(state) {
		return `SET FOREIGN_KEY_CHECKS=${mysql.escape(state ? 1 : 0)};`;
	}

	stmtDropTable(table) {
		return `DROP TABLE ${mysql.escapeId(table)};`;
	}

	stmtInsertInto(table, record) {
		let columns = Object.keys(record);
		let values = columns.map((column) => {
			record[column];
		});

		return `INSERT INTO ${mysql.escapeId(table)} () VALUES ();`;
		//TODO
	}




}

class Connection {
	constructor(restify) {
		this.restify = restify;
		this.conn = mysql.createConnection({
			host: restify._database.host,
			user: restify._database.user,
			password: restify._database.pass,
			database: restify._database.db
		});
	}

	async exec(sql) {
		return new Promise((res, rej) => {
			logger.debug(`SQL> ${sql}`);
			this.conn.query(sql, (err, rows, fields) => {
				if(err)
					return rej(err);
				return res(rows);
			});
		});
	}

	async end() {
		return new Promise((res, rej) => {
			this.conn.end((err) => {
				if(err)
					rej(err);
				res();
			});
		});
		
	}

	post(collection, item) {

	}

	get() {
	
	}

	put() {

	}

	delete() {

	}

	

	beginTransaction() {

	}

	commitTransaction() {

	}

	revertTransaction() {

	}	
}





export default Restify;
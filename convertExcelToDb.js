const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');

const directory = 'results';
const dbPath = 'database.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to SQLite database:', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

const readExcelFiles = (directory) => {
    const files = fs.readdirSync(directory);
    let combinedData = [];

    files.forEach(file => {
        if (file.endsWith('.xlsx') || file.endsWith('.xls')) {
            const filePath = path.join(directory, file);
            const workbook = xlsx.readFile(filePath);

            workbook.SheetNames.forEach(sheetName => {
                const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: null });
                combinedData = combinedData.concat(sheet);
            });
        }
    });

    return combinedData;
};

const convertExcelToDb = async () => {
    try {
        const data = readExcelFiles(directory);

        if (data.length === 0) {
            console.error('No data found in Excel files.');
            return;
        }

        console.log('First row of data:', data[0]);

        db.serialize(() => {
            db.run('DROP TABLE IF EXISTS CUTM', (err) => {
                if (err) {
                    console.error('Error dropping existing table:', err.message);
                } else {
                    console.log('Dropped existing table, if it existed.');
                }
            });

            const columns = Object.keys(data[0]).map(key => `${key} TEXT`).join(', ');
            const createTableSQL = `CREATE TABLE CUTM (${columns})`;
            console.log('Create Table SQL:', createTableSQL);

            db.run(createTableSQL, (err) => {
                if (err) {
                    console.error('Error creating table:', err.message);
                    return;
                }

                const placeholders = Object.keys(data[0]).map(() => '?').join(', ');
                const insertSQL = `INSERT INTO CUTM VALUES (${placeholders})`;
                const insertStmt = db.prepare(insertSQL);
                console.log('Insert SQL:', insertSQL);

                db.parallelize(() => {
                    data.forEach(row => {
                        const values = Object.values(row);
                        if (values.length !== Object.keys(data[0]).length) {
                            console.error('Mismatch in number of columns and values:', values);
                        } else {
                            console.log('Inserting row:', values);
                            insertStmt.run(values, (err) => {
                                if (err) {
                                    console.error('Error inserting row:', err.message);
                                }
                            });
                        }
                    });

                    insertStmt.finalize((err) => {
                        if (err) {
                            console.error('Error finalizing statement:', err.message);
                        } else {
                            console.log('Insert statement finalized.');
                        }

                        db.close((err) => {
                            if (err) {
                                console.error('Error closing database:', err.message);
                            } else {
                                console.log('Database connection closed.');
                            }
                        });
                    });
                });
            });
        });
    } catch (error) {
        console.error('Error converting Excel files to SQLite:', error);
    }
};

convertExcelToDb();

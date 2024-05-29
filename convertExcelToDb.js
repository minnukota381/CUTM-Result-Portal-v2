const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const xlsx = require('xlsx');

const directory = 'results';
const dbPath = 'database.db';

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
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

        db.serialize(() => {
            db.run('DROP TABLE IF EXISTS CUTM');

            const columns = Object.keys(data[0]).map(key => `${key} TEXT`).join(', ');
            db.run(`CREATE TABLE CUTM (${columns})`);

            const placeholders = Object.keys(data[0]).map(() => '?').join(', ');
            const insertStmt = db.prepare(`INSERT INTO CUTM VALUES (${placeholders})`);

            data.forEach(row => {
                const values = Object.values(row);
                insertStmt.run(values);
            });

            insertStmt.finalize();
        });

        console.log('Excel files successfully combined and converted to a single SQLite table.');
    } catch (error) {
        console.error('Error converting Excel files to SQLite:', error);
    } finally {
        db.close();
    }
};

convertExcelToDb();

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 5000;

const MONGO_URI = process.env.MONGO_URI;

mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('Failed to connect to MongoDB Atlas', err));

const userSchema = new mongoose.Schema({
    name: String,
    registration: String,
    semester: String,
    timestamp: Date
});
const User = mongoose.model('User', userSchema);

const dbPath = 'database.db';
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Failed to connect to SQLite database', err);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(bodyParser.urlencoded({ extended: false }));

const convertGradeToInteger = (grade) => {
    const gradeMapping = {
        'O': 10,
        'E': 9,
        'A': 8,
        'B': 7,
        'C': 6,
        'D': 5,
        'S': 0,
        'M': 0,
        'F': 0
    };
    return gradeMapping[grade] || 0;
};

const calculateSGPA = (result) => {
    let totalCredits = 0;
    let totalWeightedGrades = 0;

    result.forEach(row => {
        const creditsParts = row.Credits.split('+').map(Number);
        totalCredits += creditsParts.reduce((sum, part) => sum + part, 0);
        const grade = convertGradeToInteger(row.Grade);
        totalWeightedGrades += grade * creditsParts.reduce((sum, part) => sum + part, 0);
    });

    return totalCredits ? totalWeightedGrades / totalCredits : 0;
};

const calculateCGPA = (registration, name, callback) => {
    db.all("SELECT Credits, Grade FROM CUTM WHERE Reg_No = ? OR LOWER(Name) = LOWER(?)", [registration, name], (err, rows) => {
        if (err) {
            return callback(err);
        }

        let totalCredits = 0;
        let totalWeightedGrades = 0;

        rows.forEach(row => {
            const creditsParts = row.Credits.split('+').map(Number);
            totalCredits += creditsParts.reduce((sum, part) => sum + part, 0);
            const grade = convertGradeToInteger(row.Grade);
            totalWeightedGrades += grade * creditsParts.reduce((sum, part) => sum + part, 0);
        });

        const cgpa = totalCredits ? totalWeightedGrades / totalCredits : 0;
        callback(null, cgpa);
    });
};

app.get('/', (req, res) => {
    db.all("SELECT DISTINCT Sem FROM CUTM", (err, rows) => {
        if (err) {
            return res.render('index', { error: err.message, semesters: [] });
        }
        const semesters = rows.map(row => row.Sem);
        res.render('index', { error: null, semesters });
    });
});

app.post('/', (req, res) => {
    const { name, registration, semester } = req.body;

    db.all("SELECT * FROM CUTM WHERE (Reg_No = ? OR LOWER(Name) = LOWER(?)) AND Sem = ?", [registration, name, semester], (err, result) => {
        if (err) {
            return res.render('index', { error: err.message, semesters: [], result: null, count: 0, sgpa: null, total_credits: null, cgpa: null });
        }

        db.all("SELECT DISTINCT Sem FROM CUTM", (err, rows) => {
            if (err) {
                return res.render('index', { error: err.message, semesters: [] });
            }
            const semesters = rows.map(row => row.Sem);

            if (result.length === 0) {
                return res.render('index', { error: "No records found for the entered name or registration number.", semesters });
            }

            const sgpa = calculateSGPA(result);
            calculateCGPA(registration, name, (err, cgpa) => {
                if (err) {
                    return res.render('index', { error: err.message, semesters });
                }

                const currentTime = new Date();

                const userData = new User({
                    name,
                    registration,
                    semester,
                    timestamp: currentTime
                });

                userData.save()
                    .then(() => {
                        res.render('display', { result, count: result.length, sgpa, total_credits: result.length, cgpa, message: null });
                    })
                    .catch(err => {
                        res.render('index', { error: err.message, semesters });
                    });
            });
        });
    });
});

app.get('/convert-excel', (req, res) => {
    require('./convertExcelToDb.js');
    res.redirect('/');
});

app.get('/admin/login', (req, res) => {
    res.render('admin_login', { error: null });
});

app.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    if (username === process.env.ADMIN_USERNAME && password === process.env.ADMIN_PASSWORD) {
        res.redirect('/admin/panel');
    } else {
        res.render('admin_login', { error: 'Invalid username or password' });
    }
});

app.get('/admin/panel', (req, res) => {
    res.render('admin_panel');
});

app.get('/about', (req, res) => {
    res.render('about');
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, '../../db/memory.json');

const initializeMemory = () => {
    const dir = path.dirname(MEMORY_FILE);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(MEMORY_FILE)) {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify({ longTerm: {} }));
    }
}

const saveMemory = (key, value) => {
    initializeMemory();
    const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    data.longTerm[key] = value;
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(data, null, 2));
}

const recallMemory = (key) => {
    initializeMemory();
    const data = JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
    return data.longTerm[key];
}

module.exports = { saveMemory, recallMemory };

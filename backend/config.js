import fs from 'fs/promises';

export const getMeloriumConfig =async (req, res) => {
    try {
        const data = await fs.readFile('./melorium.json', 'utf-8');
        const config = JSON.parse(data);
        res.json(config);
    } catch (err) {
        res.status(500).json({ message: 'Ошибка чтения конфига', err });
    }
}
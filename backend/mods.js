import express from 'express';
import helmet from 'helmet';
import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const downloadRouter = express.Router();

downloadRouter.use(helmet());

downloadRouter.post('/mod', (req, res) => {
  const { modName, username, password } = req.body;

  if (!modName || !username || !password) {
    return res.status(400).json('Please provide mod name, username and password.');
  }

  if (username !== 'test' || password !== 'test') {
    return res.status(403).json('Incorrect username or password.');
  }

  const modFilePath = path.resolve(__dirname, 'mods', modName);

  fs.access(modFilePath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(404).json('The requested mod does not exist.');
    }

    res.download(modFilePath);
  });
});

export default downloadRouter;

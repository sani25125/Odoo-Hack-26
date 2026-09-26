import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log('StockSense API listening on http://localhost:' + env.port);
});

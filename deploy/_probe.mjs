import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('E:/挑战杯/data/shot.db');
console.log('total', JSON.stringify(db.prepare('select count(*) c from detections').get()));
console.log('byPrefix', JSON.stringify(db.prepare("select substr(det_id,1,6) p, count(*) c, min(confidence) mn, max(confidence) mx from detections group by p").all()));
console.log('grid19', JSON.stringify(db.prepare('select count(distinct grid_row||"_"||grid_col) c from detections where confidence>=0.75').get()));
console.log('sample', JSON.stringify(db.prepare('select det_id,confidence from detections limit 3').all()));
db.close();

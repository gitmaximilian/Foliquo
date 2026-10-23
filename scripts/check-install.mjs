import {findOffice,officeToPDF} from '../lib/formats.mjs';
import {createTranslationWord} from '../lib/word.mjs';
import {PDFDocument} from 'pdf-lib';
if(Number(process.versions.node.split('.')[0])<22)throw new Error('Node.js ab Version 22 erforderlich. Empfohlen: Node 24 LTS.');
console.log('Node.js: '+process.version);console.log('Betriebssystem: '+process.platform+' / '+process.arch);
console.log('LibreOffice: '+await findOffice());
const sample=createTranslationWord('FIKTIVER INSTALLATIONSTEST\nDatum | 07.03.1998\nMerkmale | keine besonderen Merkmale',{language:'Arabisch',targetLanguage:'Deutsch'});
const pdf=await officeToPDF(sample,'docx');if((await PDFDocument.load(pdf)).getPageCount()<1)throw new Error('Office-Konvertierung fehlgeschlagen.');
console.log('Word und PDF: OK. Keine Dokumente oder Zugangsdaten wurden an OpenAI gesendet.');

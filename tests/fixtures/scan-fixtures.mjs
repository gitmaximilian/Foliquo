import sharp from 'sharp';
import {PDFDocument,StandardFonts,degrees} from 'pdf-lib';
export async function fictionalScanPDF(){
 const width=1000,height=1400,pixels=Buffer.alloc(width*height*3);for(let y=0;y<height;y++)for(let x=0;x<width;x++){const value=145+Math.round(x/width*25),i=(y*width+x)*3;pixels[i]=pixels[i+1]=pixels[i+2]=value;}
 const dark=await sharp({create:{width,height,channels:3,background:'#181818'}}).png().toBuffer(),bright=await sharp({create:{width,height,channels:3,background:'#fefefe'}}).png().toBuffer(),blur=await sharp(pixels,{raw:{width,height,channels:3}}).blur(10).png().toBuffer(),edge=await sharp({create:{width,height,channels:3,background:'#ffffff'}}).composite([{input:Buffer.from(`<svg width="${width}" height="${height}"><rect width="${width}" height="40" fill="black"/></svg>`)}]).png().toBuffer();
 const pdf=await PDFDocument.create();for(const imageBytes of [dark,bright,blur,edge]){const image=await pdf.embedPng(imageBytes);pdf.addPage([500,700]).drawImage(image,{x:0,y:0,width:500,height:700});}
 const font=await pdf.embedFont(StandardFonts.Helvetica);for(const angle of [90,0]){const page=pdf.addPage([500,700]);page.setRotation(degrees(angle));for(let line=0;line<4;line++)page.drawText(`FICTIONAL TEXT PAGE - LINE ${line+1}`,{x:45,y:630-line*35,size:14,font});}
 return {bytes:Buffer.from(await pdf.save()),images:{dark,bright,blur,edge},expected:['dark','overexposed','blur','edge','orientation',null],pages:6};
}

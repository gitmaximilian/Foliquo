import '@fontsource-variable/manrope';
import { FoliquoLogo } from './FoliquoLogo';

export default function BrandExample(){
 return <>
   <FoliquoLogo edition="standard" variant="full" size={46}/>
   <FoliquoLogo edition="community" variant="full" size={46}/>
   <FoliquoLogo edition="standard" variant="icon" size={32}/>
   <div style={{background:'#0B0E12',padding:20}}><FoliquoLogo edition="community" theme="dark" size={46}/></div>
 </>;
}

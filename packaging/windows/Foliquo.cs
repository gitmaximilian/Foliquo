using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using System.Reflection;
[assembly: AssemblyTitle("Foliquo Community")]
[assembly: AssemblyCompany("Maximilian Auer")]
[assembly: AssemblyProduct("Foliquo Community")]
class Foliquo {
 static string Quote(string value) {
  var result=new System.Text.StringBuilder();result.Append('"');int slashes=0;
  foreach(char c in value) {
   if(c=='\\') { slashes++;continue; }
   if(c=='"') { result.Append('\\',slashes*2+1);result.Append(c);slashes=0;continue; }
   result.Append('\\',slashes);result.Append(c);slashes=0;
  }
  result.Append('\\',slashes*2);result.Append('"');return result.ToString();
 }
 static int Main(string[] args) {
  try {
   string root=AppDomain.CurrentDomain.BaseDirectory;
   // Holding a named handle lets Setup detect the running application before replacing files.
   using(var mutex=new Mutex(false,"Local\\FoliquoCommunity")) {
    var info=new ProcessStartInfo(Path.Combine(root,"runtime","node.exe"));
    info.WorkingDirectory=root;info.UseShellExecute=false;
    info.Arguments=Quote(Path.Combine(root,"bin","foliquo.mjs"));
    foreach(string arg in args)info.Arguments+=" "+Quote(arg);
    using(var process=Process.Start(info)) { process.WaitForExit();return process.ExitCode; }
   }
  } catch { Console.Error.WriteLine("Foliquo could not start. Reinstall Foliquo or run Foliquo.exe doctor in a terminal.");return 1; }
 }
}

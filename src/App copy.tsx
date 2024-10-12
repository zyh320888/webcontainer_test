import React, { useEffect, useState, useRef } from "react";
import { WebContainer } from "@webcontainer/api";
import { Terminal, ExternalLink, RefreshCw } from "lucide-react";
import StackBlitzSDK, { Project } from "@stackblitz/sdk";

const files = {
  "index.js": {
    file: {
      contents: `
import http from 'http';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Hello from WebContainer!');
});

server.listen(3000, () => {
  console.log('Server running at http://localhost:3000/');
});
      `,
    },
  },
  "package.json": {
    file: {
      contents: `
{
  "name": "example-app",
  "type": "module",
  "dependencies": {}
}
      `,
    },
  },
};

function App() {
  const [output, setOutput] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [webContainerUrl, setWebContainerUrl] = useState<string>("");

  const webContainerRef = useRef<boolean | null>(null);
  const [iframeKey, setIframeKey] = useState(0);

  // 添加这个新的辅助函数
  const cleanOutput = (data: string) => {
    return data.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
  };

  useEffect(() => {
    if (webContainerRef.current) {
      return; // 如果 WebContainer 已经启动，则直接返回
    }
    console.log("startWebContainer");
    webContainerRef.current = true;
    async function startWebContainer() {
      setIsLoading(true);
      try {
        const webcontainerInstance = await WebContainer.boot();
        await webcontainerInstance.mount(files);

        const installProcess = await webcontainerInstance.spawn("npm", [
          "install",
        ]);
        installProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              setOutput((prev) => prev + cleanOutput(data));
            },
          })
        );
        await installProcess.exit;

        const startProcess = await webcontainerInstance.spawn("node", [
          "index.js",
        ]);
        startProcess.output.pipeTo(
          new WritableStream({
            write(data) {
              setOutput((prev) => prev + cleanOutput(data));
            },
          })
        );

        webcontainerInstance.on("server-ready", (port, url) => {
          setWebContainerUrl(url);
          setOutput(
            (prev) => prev + `\n服务器已就绪，可通过以下地址访问：${url}`
          );
        });
      } catch (error) {
        console.error("Failed to start WebContainer:", error);
        setOutput("Failed to start WebContainer. Check console for details.");
      } finally {
        setIsLoading(false);
      }
    }

    startWebContainer();
  }, []);

  const openInStackBlitz = () => {
    const project = {
      files: {
        "index.js": files["index.js"].file.contents,
        "package.json": files["package.json"].file.contents,
      },
      title: "WebContainer API Example",
      description: "A simple Node.js server running in WebContainer",
      template: "node",
    };

    StackBlitzSDK.openProject(project as Project, { openFile: "index.js" });
  };

  const refreshIframe = () => {
    setIframeKey(prevKey => prevKey + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <h1 className="text-3xl font-bold mb-4">WebContainer API 示例</h1>
      <div className="bg-white shadow-md rounded-lg p-6 w-full max-w-2xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Terminal className="mr-2" />
            <h2 className="text-xl font-semibold">输出</h2>
          </div>
          <button
            onClick={openInStackBlitz}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded flex items-center"
          >
            <ExternalLink className="mr-2" size={18} />在 StackBlitz 中打开
          </button>
        </div>
        {isLoading ? (
          <p className="text-gray-600">正在启动 WebContainer...</p>
        ) : (
          <>
            <pre className="bg-black text-green-400 p-4 rounded overflow-auto max-h-96 mb-4">
              {output || "等待输出..."}
            </pre>
            {webContainerUrl && (
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold">WebContainer 预览：</p>
                  <button
                    onClick={refreshIframe}
                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-1 px-2 rounded flex items-center"
                  >
                    <RefreshCw className="mr-1" size={16} />刷新
                  </button>
                </div>
                <iframe
                  key={iframeKey}
                  src={webContainerUrl}
                  className="w-full h-64 border border-gray-300 rounded"
                  title="WebContainer Preview"
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default App;

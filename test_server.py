import http.server
import socketserver
import os
import time
import threading
import webbrowser

# ---------- 配置 ----------
PORT = 8000
DIRECTORY = "."  # 想要服务的文件夹，"." 代表当前目录
REFRESH_HTML = """
<script>
// 每隔1秒请求当前页面，如果文件有变化，服务器会返回特定状态码触发刷新
(function() {
    fetch(window.location.href, { cache: 'no-store' })
        .then(response => {
            if (response.status === 204) {
                console.log('🔄 检测到文件更新，刷新页面...');
                window.location.reload();
            }
        })
        .catch(e => console.log('Live reload check error:', e));
    setTimeout(arguments.callee, 1000);
})();
</script>
</body>
"""  # 注意：这个 </body> 用于插入到HTML中

class LiveReloadHandler(http.server.SimpleHTTPRequestHandler):
    """自定义请求处理器，支持文件修改检测"""
    last_mtime = 0

    def log_message(self, format, *args):
        # 静默日志，避免刷屏（可注释掉以查看日志）
        pass

    def do_GET(self):
        # 如果是根路径或HTML文件，注入刷新脚本
        if self.path.endswith('.html') or self.path == '/':
            # 检查当前目录下所有文件的最新修改时间
            current_mtime = self.get_max_mtime()
            if current_mtime > LiveReloadHandler.last_mtime:
                LiveReloadHandler.last_mtime = current_mtime
                # 如果文件有更新，返回 204 No Content，触发前端刷新
                self.send_response(204)
                self.end_headers()
                return
            else:
                # 正常处理请求
                return super().do_GET()
        else:
            return super().do_GET()

    def get_max_mtime(self):
        """获取当前目录及子目录下所有文件的最新修改时间"""
        max_mtime = 0
        for root, dirs, files in os.walk(DIRECTORY):
            for file in files:
                # 忽略某些文件类型（可选）
                if file.endswith(('.py', '.pyc', '.git')):
                    continue
                filepath = os.path.join(root, file)
                try:
                    mtime = os.path.getmtime(filepath)
                    if mtime > max_mtime:
                        max_mtime = mtime
                except:
                    pass
        return max_mtime

def start_server():
    """启动服务器并自动打开浏览器"""
    with socketserver.TCPServer(("", PORT), LiveReloadHandler) as httpd:
        print(f"🚀 服务已启动: http://localhost:{PORT}")
        print(f"📁 服务目录: {os.path.abspath(DIRECTORY)}")
        print("⌨️  按 Ctrl+C 停止服务")
        webbrowser.open(f"http://localhost:{PORT}")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n🛑 服务已停止")

if __name__ == "__main__":
    start_server()
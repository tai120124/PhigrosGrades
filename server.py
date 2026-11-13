"""
Flask 后端：提供静态页面 + TapTap 扫码登录 API。
运行：python server.py
依赖：pip install flask flask-cors
访问：http://127.0.0.1:5000/
"""
import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from taptap_login import request_qrcode, poll_qrcode, complete_login

# static_folder 指向当前目录，让 Flask 能直接提供 index.html、tsv、图片等
app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)


# ---------- 自检 ----------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"ok": True, "status": "running"})


# ---------- 静态首页 ----------
@app.route("/", methods=["GET"])
def index():
    return send_from_directory(".", "index.html")


# ---------- 业务 API ----------
@app.route("/api/qrcode", methods=["POST"])
def api_qrcode():
    try:
        qr = request_qrcode()
        return jsonify({"ok": True, "qr": qr})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/poll", methods=["POST"])
def api_poll():
    data = request.get_json(force=True, silent=True) or {}
    qr = {
        "device_code": data.get("device_code"),
        "device_id": data.get("device_id"),
        "expires_in": data.get("expires_in"),
        "interval": data.get("interval"),
    }
    if not qr["device_code"] or not qr["device_id"]:
        return jsonify({"ok": False, "error": "缺少 device_code 或 device_id"}), 400
    try:
        result = poll_qrcode(qr)
        return jsonify({"ok": True, **result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


@app.route("/api/complete", methods=["POST"])
def api_complete():
    data = request.get_json(force=True, silent=True) or {}
    token = data.get("token")
    qr = data.get("qr") or {}
    if not token:
        return jsonify({"ok": False, "error": "缺少 token"}), 400
    try:
        user = complete_login(qr, token)
        return jsonify({
            "ok": True,
            "sessionToken": user.get("sessionToken"),
            "user": {k: v for k, v in user.items() if k != "sessionToken"},
        })
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


if __name__ == "__main__":
    print("=" * 56)
    print(" TapTap 扫码后端已启动")
    print(" 访问页面:  http://127.0.0.1:5000/")
    print(" 健康检查:  http://127.0.0.1:5000/health")
    print("=" * 56)
    # host='0.0.0.0' 同时兼容 IPv4 与 localhost
    app.run(host="0.0.0.0", port=5000, debug=True)
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from flask import Flask, jsonify, render_template, request
import pandas as pd
import numpy as np
from src.metrics import metrics_from_csv

app = Flask(__name__)

def load_df():
    df = pd.read_csv("data/sample.csv")
    df["open_time"] = pd.to_datetime(df["open_time"])
    return df

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/latest")
def latest():
    df = load_df()
    cols = ["open_time","close","direction","confidence"]
    return jsonify(df.tail(100)[cols].to_dict(orient="records"))

@app.route("/api/equity")
def equity():
    df = load_df()
    start = request.args.get("start")
    end = request.args.get("end")
    if start and end:
        s = pd.to_datetime(start, errors="coerce")
        e = pd.to_datetime(end, errors="coerce")
        if pd.notna(s) and pd.notna(e):
            df = df[(df["open_time"] >= s) & (df["open_time"] <= e)]
    else:
        days = request.args.get("days", type=int)
        if days:
            cutoff = df["open_time"].max() - pd.Timedelta(days=days)
            df = df[df["open_time"] >= cutoff]
    df["next_close"] = df["close"].shift(-1)
    ret = np.where(df["direction"].eq("BUY"),
                   (df["next_close"] - df["close"]) / df["close"],
                   (df["close"] - df["next_close"]) / df["close"])
    ret = pd.Series(ret).fillna(0.0).clip(-0.03, 0.03)
    eq = (1 + ret).cumprod() * 1000
    out = pd.DataFrame({"t": df["open_time"].astype(str), "equity": eq.round(2)})
    out = out.tail(300).reset_index(drop=True)
    return jsonify(out.to_dict(orient="records"))

@app.route("/api/metrics")
def metrics():
    df = load_df()
    start = request.args.get("start")
    end = request.args.get("end")
    if start and end:
        s = pd.to_datetime(start, errors="coerce")
        e = pd.to_datetime(end, errors="coerce")
        if pd.notna(s) and pd.notna(e):
            df = df[(df["open_time"] >= s) & (df["open_time"] <= e)]
            tmp = "data/_tmp_metrics.csv"
            df.to_csv(tmp, index=False)
            m = metrics_from_csv(tmp)
            return jsonify(m)
    days = request.args.get("days", type=int)
    if days:
        cutoff = df["open_time"].max() - pd.Timedelta(days=days)
        df = df[df["open_time"] >= cutoff]
        tmp = "data/_tmp_metrics.csv"
        df.to_csv(tmp, index=False)
        m = metrics_from_csv(tmp)
        return jsonify(m)
    m = metrics_from_csv("data/sample.csv")
    return jsonify(m)

@app.route("/api/trades")
def trades():
    df = load_df()
    start = request.args.get("start")
    end = request.args.get("end")
    if start and end:
        s = pd.to_datetime(start, errors="coerce")
        e = pd.to_datetime(end, errors="coerce")
        if pd.notna(s) and pd.notna(e):
            df = df[(df["open_time"] >= s) & (df["open_time"] <= e)]
    else:
        days = request.args.get("days", type=int)
        if days:
            cutoff = df["open_time"].max() - pd.Timedelta(days=days)
            df = df[df["open_time"] >= cutoff]
    df["next_close"] = df["close"].shift(-1)
    ret = np.where(df["direction"].eq("BUY"),
                   (df["next_close"] - df["close"]) / df["close"],
                   (df["close"] - df["next_close"]) / df["close"])
    ret = pd.Series(ret).fillna(0.0).clip(-0.03, 0.03)
    notional = 100.0
    pnl_usd = (ret * notional).round(2)
    out = pd.DataFrame({
        "time": df["open_time"].astype(str),
        "direction": df["direction"].astype(str),
        "entry": df["close"].round(4),
        "exit": df["next_close"].round(4),
        "ret_pct": (ret * 100).round(2),
        "pnl_usd": pnl_usd
    }).dropna()
    limit = request.args.get("limit", default=50, type=int)
    out = out.tail(limit).iloc[::-1].reset_index(drop=True)
    return jsonify(out.to_dict(orient="records"))

if __name__ == "__main__":
    app.run(debug=True)

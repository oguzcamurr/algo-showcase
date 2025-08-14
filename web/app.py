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
    days = request.args.get("days", type=int)
    df = load_df()
    if days:
        cutoff = df["open_time"].max() - pd.Timedelta(days=days)
        df = df[df["open_time"] >= cutoff]
    df["next_close"] = df["close"].shift(-1)
    ret = np.where(df["direction"].eq("BUY"),
                   (df["next_close"]-df["close"])/df["close"],
                   (df["close"]-df["next_close"])/df["close"])
    ret = pd.Series(ret).fillna(0.0).clip(-0.03,0.03)
    eq = (1+ret).cumprod()*1000
    out = pd.DataFrame({"t": df["open_time"].astype(str), "equity": eq.round(2)})
    out = out.tail(300).reset_index(drop=True)
    return jsonify(out.to_dict(orient="records"))

@app.route("/api/metrics")
def metrics():
    days = request.args.get("days", type=int)
    df = load_df()
    if days:
        cutoff = df["open_time"].max() - pd.Timedelta(days=days)
        df = df[df["open_time"] >= cutoff]
        tmp = "data/_tmp_metrics.csv"
        df.to_csv(tmp, index=False)
        m = metrics_from_csv(tmp)
    else:
        m = metrics_from_csv("data/sample.csv")
    return jsonify(m)

if __name__ == "__main__":
    app.run(debug=True)

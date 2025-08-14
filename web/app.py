from flask import Flask, jsonify, render_template
import pandas as pd

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/latest")
def latest():
    df = pd.read_csv("data/sample.csv")
    cols = ["open_time","close","direction","confidence"]
    return jsonify(df.tail(100)[cols].to_dict(orient="records"))

if __name__ == "__main__":
    app.run(debug=True)

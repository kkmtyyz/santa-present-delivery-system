/*
- $ npm ci
- $ npm install -g nodemon
- $ npm start
  - or 
    - $ node main.js
*/

const express = require("express");
const cors = require("cors");
const app = express();
const port = 8080;
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

app.get("/", async (req, res) => {
  console.log("[GET][/] begin");
  // await sleep(5 * 1000);
  const body = {
    facility: {
      name: "サンタさんの家",
      address: "住所0-0-0",
      point: [38.26099, 140.881155],
    },
    presents: [
      {
        name: "ツチノコのぬいぐるみ",
        address: "宮城県仙台市青葉区中央三丁目７番１号",
        point: [38.259464, 140.879929],
      },
      {
        name: "ポケモンカード",
        address: "宮城県仙台市青葉区中央四丁目８番１号",
        point: [38.257568, 140.87973],
      },
      {
        name: "ゴジラのしっぽ",
        address: "宮城県仙台市青葉区一番町一丁目１４番３５号",
        point: [38.256062, 140.873245],
      },
      {
        name: "たまごっち",
        address: "宮城県仙台市青葉区一番町一丁目８番３号",
        point: [38.257244, 140.87645],
      },
      {
        name: "クレヨン",
        address: "宮城県仙台市青葉区一番町二丁目３番１３号",
        point: [38.258324, 140.874039],
      },
    ],
    route_flex_polylines: [
      "BG4vo_oC4w22sInHpCpB3UZlUZrVZrVXlUR5KpD9SnH7pBnD_S_BvLzD9UxD9UzD9U_BtLpCvOtD9UrD_UtD_UpCtOhJsFpPkJpPiJhJsF3KuGnPkJ3KsGtD3MxHliBZjDzE5QvFnUzE7Q7CnL",
      "BGglj_oC-5o2sIAAxE7S_EvU9EvUxE7S_JkDrQmF_JkDnCa_OgFhP-E7fiLxKuDjHmCyE9N",
      "BGog_-oCkkn2sI8B3FuG3ToEmG_EyP_EwPjFqPxG2TzG4TzG2TjFqPzM4nBvEoM3D2IzIoIsEmT8IgeoEqOgGiUoEoOuMlHu9BzjBuMlH-H1EsI9E",
      "BG0ph_oC40t2sIgHhE-H1EmMjHoMjH8H_EkPzJiPzJ-HhFuD4M1M6HnPqJ1M6HlbyQxJsFrP4IxJuF8C4NqE2UoE4UqE2U8C4NwCyLwE2UyCyL-DsT-DsT_C6BnCsB",
      "BG-6h_oC05z2sIpIkFlPqJnPqJlPqJvJ4FhEwCkF0RmFyR-FyT8FyT6KnG4e1RsP7I4KnGiK_FoPjJyenSiK_FkPlJmPpJ8BjB",
      "BGszl_oCmr02sIoNhIoMvHoPnJoMvHwNxHyNxHgK5GawLIkMQsVOuVQsVIkM4BqRuCgI",
    ],
  };

  res.json(body);
  console.log("[GET][/] end");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

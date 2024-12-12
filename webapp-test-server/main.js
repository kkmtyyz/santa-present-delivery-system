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
        point: [38.260990, 140.881155]
    },
    presents: [
        {
            name: "ツチノコのぬいぐるみ",
            address: "住所1-2-3",
            point: [38.259464, 140.879929]
        },
        {
            name: "ポケモンカード",
            address: "住所4-5-6",
            point: [38.257164, 140.871231]
        },
        {
            name: "ゴジラのしっぽ",
            address: "住所7-8-9",
            point: [38.257568, 140.87973]
        },
    ],
    route_flex_polylines: ["BG-kp_oCqn82sI5CTjCqRzCmVjCqR5OhD3OjDrB-KxCmVpB-KnC2UnC2UZsI7O1C3Q_C9O1C3GnB7NvC3Q_C7NvChL9B1Q9ChL9BtP1CthB9FtP3C9PzC3Q5C3Q5C9PzCjF1EpQxPzKtL7M5NzKtL3HlN3E9N_BrIvBjNYpK6ChV6ChVehH2B9N4B7NO5DoBxJ8B_O-BhP0EjIiLgC4QgDiLgCkEL-NxDyQnE-NxD6KnG4e1RsP7I4KnGiK_FoPjJyenSiK_FkPlJmPpJ8BjB", "BGszl_oCmr02sIAA", "BGszl_oCmr02sIAA", "BGszl_oCmr02sIAA", "BGszl_oCmr02sIoNhIxEhSpK3oBxEhSjFjUlFrUlFtUjFjU_E_ThFhUtD3NjFtUvD3NtD3MxHliBZjDzE5QvFnUzE7Q7CnLxE7S_EvU9EvUxE7SjFzTnFrUpFpUhF1TTjCzBvH1CnNzCpN5D7S5D7S9E2BlEuB1E0BvE2NrG8T5BuF", "BGwzg_oCg9i2sIzEsOtE2N3D0K3D0KvEwNxG4TxG4TvEwN_EyP_EwPjFqPxG2TzG4TzG2TjFqPzM4nBvEoM3D2IzIoIsEmT8IgeoEqOgGiUoEoOuMlHu9BzjBuMlH6C8L8C4NqE2UoE4UqE2U8C4NwCyLwE2UyCyL-DsT-DsT_C6BnCsB", "BG-6h_oC05z2sIpIkFlPqJnPqJlPqJvJ4FhEwCkF0RmFyR-FyT8FyTmE4GuDuI6DkN-FiU8DkNsB-E-C0KwKolB4BwI5B2S3B4SkLsC0QyD0Q0D2Q0DkLsCsPmD2QwD0QuD2QwDsPmDkHoBshB2G8FoByGoB4OkD6OiDkCpR0ClVkCpR6CU"]
  };

  res.json(body);
  console.log("[GET][/] end");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});

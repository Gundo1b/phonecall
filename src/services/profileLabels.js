export function genderLabel(gender) {
  return ({ woman: "Woman", man: "Man", nonbinary: "Nonbinary", self_described: "Another identity", prefer_not_to_say: "Gender not shared" })[gender] || "Gender not shared";
}

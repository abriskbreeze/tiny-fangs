let state = 16;

Math.random = () => {
  state = (state * 1_664_525 + 1_013_904_223) >>> 0;
  return state / 4_294_967_296;
};

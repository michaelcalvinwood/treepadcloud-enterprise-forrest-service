const array = ['a', 'b', 'c', 'd'];
const newStuff = ['e', 'f'];

function insertIntoArray(arr, pos, el) {
	for (let i = 0; i < el.length; ++i) {
		array.splice(pos + i, 0, el[i]);
	}
}

insertIntoArray(array, 1, newStuff);

console.log(array);

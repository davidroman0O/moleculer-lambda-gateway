
module.exports = {
	name: "@maths",
	actions: {
		"#operations/add": (ctx) => {
			const { a, b } = ctx.params;
			return a + b;
		}
	}
}

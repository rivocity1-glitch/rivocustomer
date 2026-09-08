module.exports = function normalizeProductImageBabelPlugin({ types: t }) {
  return {
    name: "normalize-rivo-product-image-url",
    visitor: {
      Program(path, state) {
        const filename = state.filename || "";
        const isStoreScreen = /[\\/]src[\\/]app[\\/]store[\\/]\[id\]\.tsx$/.test(
          filename
        );

        if (!isStoreScreen) return;

        let replaced = false;

        path.traverse({
          ObjectProperty(propertyPath) {
            if (replaced) return;

            const key = propertyPath.node.key;
            const value = propertyPath.node.value;

            if (
              !t.isIdentifier(key, { name: "uri" }) ||
              !t.isMemberExpression(value) ||
              value.computed ||
              !t.isIdentifier(value.object, { name: "item" }) ||
              !t.isIdentifier(value.property, { name: "image_url" })
            ) {
              return;
            }

            propertyPath.get("value").replaceWith(
              t.callExpression(
                t.identifier("__rivoParseProductImageUrl"),
                [value]
              )
            );

            replaced = true;
          },
        });

        if (!replaced) return;

        const helper = t.functionDeclaration(
          t.identifier("__rivoParseProductImageUrl"),
          [t.identifier("value")],
          t.blockStatement([
            t.ifStatement(
              t.unaryExpression("!", t.identifier("value")),
              t.blockStatement([t.returnStatement(t.nullLiteral())])
            ),
            t.ifStatement(
              t.callExpression(
                t.memberExpression(t.identifier("Array"), t.identifier("isArray")),
                [t.identifier("value")]
              ),
              t.blockStatement([
                t.returnStatement(
                  t.conditionalExpression(
                    t.binaryExpression(
                      "===",
                      t.unaryExpression(
                        "typeof",
                        t.memberExpression(t.identifier("value"), t.numericLiteral(0), true)
                      ),
                      t.stringLiteral("string")
                    ),
                    t.memberExpression(t.identifier("value"), t.numericLiteral(0), true),
                    t.nullLiteral()
                  )
                ),
              ])
            ),
            t.ifStatement(
              t.binaryExpression(
                "!==",
                t.unaryExpression("typeof", t.identifier("value")),
                t.stringLiteral("string")
              ),
              t.blockStatement([t.returnStatement(t.nullLiteral())])
            ),
            t.tryStatement(
              t.blockStatement([
                t.variableDeclaration("const", [
                  t.variableDeclarator(
                    t.identifier("parsed"),
                    t.callExpression(
                      t.memberExpression(t.identifier("JSON"), t.identifier("parse")),
                      [t.identifier("value")]
                    )
                  ),
                ]),
                t.ifStatement(
                  t.callExpression(
                    t.memberExpression(t.identifier("Array"), t.identifier("isArray")),
                    [t.identifier("parsed")]
                  ),
                  t.blockStatement([
                    t.returnStatement(
                      t.conditionalExpression(
                        t.binaryExpression(
                          "===",
                          t.unaryExpression(
                            "typeof",
                            t.memberExpression(t.identifier("parsed"), t.numericLiteral(0), true)
                          ),
                          t.stringLiteral("string")
                        ),
                        t.memberExpression(t.identifier("parsed"), t.numericLiteral(0), true),
                        t.nullLiteral()
                      )
                    ),
                  ])
                ),
              ]),
              null,
              t.blockStatement([])
            ),
            t.returnStatement(t.identifier("value")),
          ])
        );

        path.unshiftContainer("body", helper);
      },
    },
  };
};

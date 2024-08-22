import oldDocs from "./3.9.1"
import { clone, insert } from "./helpers"

// never forget to clone the old docs first!
const docs = clone(oldDocs)

insert(docs, "vertx-mongo-client", {
  id: "vertx-db2-client",
  name: "DB2",
  description: "The Reactive DB2 client.",
  category: "databases",
  href: "/vertx-db2-client/java/",
  repository: "https://github.com/eclipse-vertx/vertx-sql-client",
  edit: "https://github.com/eclipse-vertx/vertx-sql-client/tree/master/vertx-db2-client/src/main/asciidoc",
  examples:
    "https://github.com/vert-x3/vertx-examples/tree/3.x/reactive-sql-client-examples",
  label: "Preview",
})

export default docs

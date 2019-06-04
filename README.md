# sails-arangojs

Provides easy access to `ArangoDB` from Sails.js & Waterline.

This module is a Sails/Waterline community adapter. Its goal is to provide a set of declarative interfaces, conventions, and best-practices for integrating with the ArangoDB database/service.

Strict adherence to an adapter specification enables the (re)use of built-in generic test suites, standardized documentation, reasonable expectations around the API for your users, and overall, a more pleasant development experience for everyone.

## Installation

To install this adapter, run:

```sh
$ npm install sails-arangojs
```

### Updates done on waterline (waternile)

ArangoDB being a Graph/Document/Key-Value Database, small changes had to be done on the orm to accomodate this nature of the database. It also allows us to harness the powerful features of a Graph Database right away from sails. No changes were made on the hook-orm despite cloning it to another module (sails-orm-hook). This was done to bring on board waternile orm as a package.

remove sails-hook-orm from your package.json to avoid conflict.

After installing sails-arangojs, please install the orm hook and waterline

```sh
$ npm install sails-orm-hook
```

Then [connect the adapter](https://sailsjs.com/documentation/reference/configuration/sails-config-datastores) to one or more of your app's datastores.

```
  default: {
    adapter: 'sails-arangojs',
    url: 'arangodb://user:password@localhost:2424/db',
  },
  graph: true,
```

When graph is true, make sure migrations are not `alter`

Under config.models, make it look like below if you are using sails-arangojs as ther default adapter

```
 attributes: {
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
    id: { type: 'string', columnName: '_key' },
    _id: { type: 'string' },
 },


```

## Usage

Visit [Models & ORM](https://sailsjs.com/docs/concepts/models-and-orm) in the docs for more information about using models, datastores, and adapters in your app/microservice.

### Additional Features

When defining Models, you can specify the class of the model to be mapped on arangodb

```
  classType: 'Document', //Either of Document, Edge (default is Document)
  .
  .
  attributes: {
       id: { type: 'string' , columnName: '_key' },
  }
```

### Query Language

On top of what is implemented on sails waterline, you can opt in to use the following in your query objects. This was a matter of preference for readability.

$lt,
  $lte,
$gt,
  $gte,
$ne,
  $nin,
$in,
  $like,
$contains,
  $startsWith,
\$endsWith,

\$has

\$has is used to query fields of `Array<string> or Array<number>` example {Roles:{\$has:'Admin'}} will get users that has a role of Admin supposing the `Roles` field has a format of ['Admin', 'Owner' ...]

## Go Native

If you want to write queries using the the ArangoJs Driver, the adapter exposes the Database connection instance just as you would get with const db = new Database();

```
const {dbConnection, aql, graph, foxx} = Model.getDatastore().manager;

// Then you can use the connection as

const collection = dbConnection.collection("model");
const data = { some: "data" };
const info = await collection.save(data);

//OR

const cursor = await dbConnection.query('FOR record IN model RETURN record');

```

## Questions?

See [Extending Sails > Adapters > Custom Adapters](https://sailsjs.com/documentation/concepts/extending-sails/adapters/custom-adapters) in the [Sails documentation](https://sailsjs.com/documentation), or check out [recommended support options](https://sailsjs.com/support).

<a href="https://sailsjs.com" target="_blank" title="Node.js framework for building realtime APIs."><img src="https://github-camo.global.ssl.fastly.net/9e49073459ed4e0e2687b80eaf515d87b0da4a6b/687474703a2f2f62616c64657264617368792e6769746875622e696f2f7361696c732f696d616765732f6c6f676f2e706e67" width=60 alt="Sails.js logo (small)"/></a>

## Compatibility

This adapter implements the following methods:

| Method            | Status | Category  |
| :---------------- | :----- | :-------- |
| registerDatastore | done   | LIFECYCLE |
| teardown          | done   | LIFECYCLE |
| create            | Done   | DML       |
| createEach        | Done   | DML       |
| update            | Done   | DML       |
| destroy           | Done   | DML       |
| find              | Done   | DQL       |
| count             | Done   | DQL       |
| sum               | Done   | DQL       |
| avg               | Done   | DQL       |
| define            | Done   | DDL       |
| drop              | Done   | DDL       |

graph databases methods:

| Method              | Status | Category |
| :------------------ | :----- | :------- |
| createEdge          | Done   | DML      |
| getOutboundVertices | Done   | DQL      |
| getInboundVertices  | Done   | DQL      |

## createEdge Method

The following is an example of creating an edge.

```

   const edgeproperties = {
        Year: 2008,
        Month: 1,
        Day: 1,
        DayOfWeek: 2,
        DepTime: 644,
        ArrTime: 866,
        DepTimeUTC: '2008-01-01T11:04:00.000Z',
        ArrTimeUTC: '2008-01-01T13:06:00.000Z',
        UniqueCarrier: '9E',
        FlightNum: 2938,
        TailNum: '87979E',
        Distance: 444,
      };

      const from_id = 'airport/00M';
      const to_id = 'airport/00R';

      Flight.createEdge(
        edgeproperties,
        {
          from: from_id,
          to: to_id,
        },
        (err, edge) => {
          if (err) {
            return done(err);
          }

          assert.equal(edge._from, `${from_id}`);
          assert.equal(edge._to, `${to_id}`);
      })
```

## getOutboundVertices && getInboundVertices Methods

The following is an example of getting vertices connecting to a node

```
     //Flights connecting from an airport
     const airports = await Airport.getOutboundVertices(['flights], 'airport/00M');

     // or

    //Flights connecting to an airport
    const airports = await Airport.getInboundVertices(['flights], 'airport/00M');

```

the above will return an array of nodes and edges. [{vertex: {...}, edge:{...}}, ...]

You can filter Vertices and Edges using .whereVertex({...}) and whereEdge({...}) methods.

## Testing

The following featers interfaces are implemented.

```
    "interfaces": [
      "semantic",
      "queryable",
      "migratable",
      "sql",
      "graph"
    ],
    "features": [
      "unique"
    ]

```

Clone the repo, create a testdb and run

```
 WATERLINE_ADAPTER_TESTS_URL=arangodb://root@localhost:8529/testdb npm test

```

## License

This sails-arangojs adapter is available under the **MIT license**.

As for [Waterline](http://waterlinejs.org) and the [Sails framework](https://sailsjs.com)? They're free and open-source under the [MIT License](https://sailsjs.com/license).

![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)

# sails-arangojs

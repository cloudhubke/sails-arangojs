# sails-orientjs

Provides easy access to `OrientDB` from Sails.js & Waterline.

This module is a Sails/Waterline community adapter.  Its goal is to provide a set of declarative interfaces, conventions, and best-practices for integrating with the OrientDB database/service.

Strict adherence to an adapter specification enables the (re)use of built-in generic test suites, standardized documentation, reasonable expectations around the API for your users, and overall, a more pleasant development experience for everyone.


## Installation

To install this adapter, run:

```sh
$ npm install sails-orientjs
```

### Updates done on waterline (waternile)

Orient DB being a Graph/Document/Key-Value Database, small changes had to be done on the orm to accomodate this nature of the database. It also allows us to harness the powerful features of a Graph Database right away from sails.  No changes were made on the hook-orm despite cloning it to another module (sails-orm-hook). This was done to bring on board waternile orm as a package. 

remove sails-hook-orm from your package.json to avoid conflict.

After installing sails-orientjs, please install the orm hook and waterline

```sh
$ npm install sails-orm-hook
```


Then [connect the adapter](https://sailsjs.com/documentation/reference/configuration/sails-config-datastores) to one or more of your app's datastores.

```
  default: {
    adapter: 'sails-orientjs',
    url: 'orientdb://user:password@localhost:2424/db',
  },
```

Under config.models, make it look like below if you are using sails-orientjs as ther default adapter

```
 attributes: {
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
    id: { type: 'string', autoIncrement: true },
 }
```

## Usage

Visit [Models & ORM](https://sailsjs.com/docs/concepts/models-and-orm) in the docs for more information about using models, datastores, and adapters in your app/microservice.

### Additional Features 
When defining Models, you can specify the class of the model to be mapped on orientdb 

```
  classType: 'Vertex', //Either of Document, Vertex, Edge (default is Document)
  .
  .
  attributes: {
       id: { type: 'string', autoIncrement: true },
  }
```


### Query Language

On top of what is implemented on sails waterline, you can opt in to use the following in your query objects.  This was a matter of preference for readability.

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
  $endsWith,
  
  
  

## Questions?

See [Extending Sails > Adapters > Custom Adapters](https://sailsjs.com/documentation/concepts/extending-sails/adapters/custom-adapters) in the [Sails documentation](https://sailsjs.com/documentation), or check out [recommended support options](https://sailsjs.com/support).

<a href="https://sailsjs.com" target="_blank" title="Node.js framework for building realtime APIs."><img src="https://github-camo.global.ssl.fastly.net/9e49073459ed4e0e2687b80eaf515d87b0da4a6b/687474703a2f2f62616c64657264617368792e6769746875622e696f2f7361696c732f696d616765732f6c6f676f2e706e67" width=60 alt="Sails.js logo (small)"/></a>


## Compatibility

This adapter implements the following methods:

| Method               | Status            | Category      |
|:---------------------|:------------------|:--------------|
| registerDatastore    | done              | LIFECYCLE     |
| teardown             | done              | LIFECYCLE     |
| create               | Done              | DML           |
| createEach           | Done              | DML           |
| update               | Done              | DML           |
| destroy              | Done              | DML           |
| find                 | Done              | DQL           |
| count                | Done              | DQL           |
| sum                  | Done              | DQL           |
| avg                  | Done              | DQL           |
| define               | Done              | DDL           |
| drop                 | Done              | DDL           |


## License

This sails-orientjs adapter is available under the **MIT license**.

As for [Waterline](http://waterlinejs.org) and the [Sails framework](https://sailsjs.com)?  They're free and open-source under the [MIT License](https://sailsjs.com/license).


![image_squidhome@2x.png](http://i.imgur.com/RIvu9.png)
# sails-orientjs

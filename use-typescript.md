How to Use Typescript & Sails JS for Your REST API (Safer Seas)
John Grisham
John Grisham
Follow

Mar 30, 2021 · 8 min read

Sea Turtle — dives
Shoutin’, typing’ an’ screamin’ — that be how we sail.
Have you ever seen Pirates of the Caribbean? It’s a Disney film series based on the exploits of various fictional pirate characters and pirate lore. The film’s make being a pirate sound cool as a sea cucumber but in reality, the average life expectancy of a pirate was around 26 years, a dangerous life indeed.
So why am I talking about pirates? My point is that freedom in life just like freedom in code is not always a good thing. That’s why I love Typescript. Coding can be freeing but with that freedom comes a lot of danger. With Typescript troubled waters become much safer.
I’m going to take you through my journey with Sails JS and Typescript so far and show you some tricks I’ve learned along the way. So let’s get started!
Typescript with Sails JS
Sails doesn’t use typescript by default but does support it. I won’t dive very deep into getting started with Sails or integrating Typescript but you can configure a sails project with Typescript very easily by following the docs:
Using TypeScript
But Sails also supports using TypeScript to write your custom app code (like actions and models). You can enable this…
sailsjs.com

note: The docs will have you install ts-node, typescript, and the necessary types as dependencies but make sure you install these as Dev dependencies only.
Creating Types
If you have a Sails project with Typescript ready you can follow along. In case you’re interested here’s my tsconfig:
{
"compilerOptions": {
"target": "es6",
"allowJs": true,
"skipLibCheck": true,
"strict": false,
"forceConsistentCasingInFileNames": true,
"noEmit": true,
"esModuleInterop": true,
"module": "commonjs",
"moduleResolution": "node",
"resolveJsonModule": true,
"isolatedModules": false,
"jsx": "preserve",
"lib": ["es2018", "DOM", "ESNext"],
"sourceMap": true,
"baseUrl": "./",
"outDir": "./build",
"rootDir": "./"
},
"exclude": ["node_modules"],
"include": ["./**/*.ts", "./**/*.tsx"]
}
We’re going to make a basic turtle type that we’ll use in a minute. So go ahead and create an interfaces folder in API and inside it make a turtle.ts file:
// api/interfaces/turtle.ts
export interface Turtle {
shellColor: string
age: number
}
These are just some basic props to illustrate how Typescript works. We’ll use this type for the inputs in a standalone action. Similarly, we will want to define our exits type as well:
// api/interfaces/exits.ts
export interface Exits {
error: (response: Record<string, unknown>) => void
success: (response: Record<string, unknown>) => void
}
If you aren’t familiar with Typescript the Record type is sort-of like an object so what we’re defining is two functions that will receive generic objects and return void. (But in reality, both these functions will return a response from the action.)
I also like to use an index file to manage my imports I recommend you do the same:
// api/interfaces/index.ts
export _ from './exits'
export _ from './turtle'
Our first API endpoint
note: Going forward you may have to stop and restart your sails app to see these changes).
It is now recommended by the developers at Sails to use the new Actions 2 format for actions. I like this format and I also like standalone actions because we don’t have to explicitly define the routes to our endpoints, enabling automatic routes for standalone actions is easy. Just add this line in your config/blueprints.js file:
actions: true,
This will allow our actions to be available at a logical location in our API by default. Go ahead and create a new standalone action by using the sails cli or by just copying the code:
sails generate action turtles/sea
This will generate an action in api/controllers/turtles/sea, by default, this is a .js file so rename it to a .ts file and replace the contents with this:
import { Exits, Turtle } from '../../interfaces'
import sails from 'sails'
module.exports = {
friendlyName: 'Sea Turtles!',
description: 'Turtles all the way down.',
inputs: {},
exits: {
error: {
message: 'Error!'
},
success: {
data: null,
message: 'success!'
}
},
fn: async function (inputs: Turtle, exits: Exits) {
exits.success({ message: 'success', data: inputs });
}
}
Navigating to localhost/turtles/sea should return this:
{
"message": "success",
"data": {}
}
Congrats you created a standalone action in Sails JS now it’s time for some deep-sea diving.
Generating Sails Schema’s from Types
So we have a couple of types and an action but you may have noticed something missing. While we have defined what the exits should look like in the action schema we haven’t done so with the inputs. One problem I have with Actions 2 is that even though we gave types to our inputs and exits we still have to include them in the schema for Sails to understand what they are. If you were to try sending parameters to this endpoint they would get wiped and nothing would be returned.
I decided to create a helper that generates a Sails JS schema from a Typescript type. That way we can keep our types in sync with our schema and we don’t have to repeat ourselves. To do this we’ll need help from this library.
YousefED/typescript-json-schema
Generate json-schemas from your Typescript sources. Compiles your Typescript program to get complete type information…
github.com

You can add it via yarn like so:
yarn add typescript-json-schema
The above library will take a Type and spit out a plain JSON object that we can use for our inputs. Inside api/helpers create a new file called generate-schema.ts and paste the following code into it:
// api/helpers/generate-schema.ts
import { resolve } from "path";
import \* as TJS from "typescript-json-schema";
import sails from 'sails'
interface GeneratorInputs {
filePath: string
name: string
}
interface GeneratorExits {
success: (definition: TJS.Definition) => TJS.Definition
}
const settings: TJS.PartialArgs = {
required: true
};
const compilerOptions: TJS.CompilerOptions = {
strictNullChecks: true,
};
module.exports = {
friendlyName: 'Generate Schema',
description: 'Generate schema from types!',
sync: true,
inputs: {
filePath: {
type: 'string',
example: 'my-type.ts',
description: 'The path to your type file.',
required: true
},
name: {
type: 'string',
example: 'myType',
description: 'The type name',
required: true
}
},
fn: function (inputs: GeneratorInputs, exits: GeneratorExits) {
try {
const typePath = resolve(`./api/interfaces/${inputs.filePath}`)
sails.log.info(`generating inputs for type: ${inputs.name} at path: ${typePath}...`)
const program = TJS.getProgramFromFiles(
[typePath],
compilerOptions
)
const schema = TJS.generateSchema(program, inputs.name, settings)
return exits.success(schema)
} catch (err) {
throw new Error(`Could not generate types: ${err.message}`)
}
}
}
The helper we just made will take a file path which is basically just the file name in this instance and a type name to create a program that will get passed to the generateSchema function. It’s OK if you don’t understand what’s going on in the background with this library. When we’re done we will either return the newly created schema or throw an error. The output will look something like this when we call it with the turtle type.
{
"type": "object",
"properties": {
"shellColor": {
"type": "string"
},
"age": {
"type": "number"
}
},
"required": [
"age",
"shellColor"
],
"$schema": "http://json-schema.org/draft-07/schema#"
  }
Awesome! Right away we have a JSON object that has all our properties defined along with their type and whether or not they are required. However, there are a few issues here.
Properties are not necessary for the schema
The required field needs to be on the property itself
Type of “object” is not supported in Sails
In order to solve these issues, we’ll need to parse and manipulate the generated schema. But to add a layer of complexity we will need to do so recursively since types can be nested.
Finally, a recursive problem in programming that isn’t inverting a binary tree!
Turtles all the way down
Let’s make our Turtle type even more complex:
export interface Turtle {
  shellColor: string
  size: { length: number, weight?: number },
  age?: number
}
We’ll make age optional by adding the question mark before the type and add a size prop with length and an optional weight prop, because it’s rude to ask a turtle its age or weight! Now that we have a more complex type to test let’s create a format function and put it between the compiler options and the module exports.
const formatSchema = (obj: TJS.Definition) => {
    const format = (layer: TJS.Definition) => {
      const keys = Object.keys(layer)
      keys.forEach(key => {
        if (key === "properties" || layer[key]?.hasOwnProperty("properties")) {
          let newProperties = {}
          let nextRequired = []
          if(key === "properties") {
            newProperties = Object.assign(layer, layer[key]);
            nextRequired = layer["required"]
            delete layer["type"]
            delete layer["required"]
            delete layer[key];
          } else {
            newProperties = Object.assign(layer[key], layer[key]["properties"]);
            nextRequired = layer[key]["required"] || []
            newProperties["required"] = layer["required"].includes(key)
            delete layer[key]["properties"];
          }
          if(newProperties["type"] === "object") {
             newProperties["type"] = "ref"
          }
          format({ ...newProperties, required: nextRequired  })
        } else if (key !== 'type' && key !== 'required') {
          layer[key]["required"] = layer["required"]?.includes(key) || false
        }
      })
      return layer
  }
    delete obj.$schema
return format(obj);
}
This will go through each “layer” of the type iterate the keys and unwrap its properties from the parent object. It will also determine if each property is required and what the type is. And since “ref” is the approximation of object in the Sails schema we’ll replace references to object with “ref”. As a last touch, we’ll delete the $schema prop since it’s not needed. Now replace the call to create the schema with this:
const schema = formatSchema(TJS.generateSchema(program, inputs.name, settings))
Now in sea.ts call the helper as an exit with the turtle type:
exits.success({ data: sails.helpers.generateSchema('turtle', 'Turtle') })
When you visit localhost:8080/turtles/sea you should see this:
{
"data": {
"shellColor": {
"type": "string",
"required": true
},
"size": {
"type": "ref",
"required": true,
"length": {
"type": "number",
"required": true
},
"weight": {
"type": "number",
"required": false
}
},
"age": {
"type": "number",
"required": false
}
}
}
But of course, we don’t want to return the generated schema we want to use it as our inputs so replace the inputs with the helper instead:
inputs: sails.helpers.generateSchema('turtle', 'Turtle'),
And just return the inputs:
exits.success({ data: inputs })
When you stop your Sails app and re-lift you’ll see the generation log get called at our endpoint and just like that we have generated inputs and type safety!
You can test it out by passing parameters for a turtle, like so: Test Endpoint with Parameters
Conclusion
This concludes my introduction to Sails JS and Typescript.
What we covered:
Creating interfaces
Actions 2 and standalone actions
Automatic routes for actions
Generated Sails Schema
l like how easy it is to start using Typescript with Sails JS but I do wish Sails had type definitions. I would love to start adding them if there is enough interest. Let me know what you think about it here.
Add type definitions · Issue #7110 · balderdashy/sails
This is just an issue to track interest in type definitions for the framework. If there is enough interest I will…
github.com

And for more tutorials about Sails, Pirates, and programming follow me on Twitter @SquashBugler.
The quote at the beginning was generated at The pirate quotes generator
And my favorite quote generated there.
I think that be his ol’ poop deck. Blimey!
I’m a child, I know. Thanks for joining me and feel free to share your favorite pirate quotes in the comments.

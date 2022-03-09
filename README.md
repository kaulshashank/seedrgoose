# `seedrgoose`

Composable seeding for mongoose models.

## Example

```
import { model, seed } from "seedrgoose";
import mongoose from "mongoose";

// Create models

const MageSchema = new mongoose.Schema({ /* ... */ });
const MageModel = mongoose.model("mages", MageSchema);

const DragonSchema = new mongoose.Schema({ /* ... */ });
const DragonModel = mongoose.model("dragons", DragonSchema);

// Connect mongoose to your database

await mongoose.connect("mongodb://localhost:27017");

// Model references across models

const refs = [
    {
        model: DragonModel,
        keys: [
            { key: "mageId", model: MageModel }
        ]
    }
];

// Create seeder methods

const mage = model(MageModel, refs);
const dragon = model(DragonModel, refs);

// Compose a dragon and mage document
// where dragon.mageId == parent mage._id
// reference for this is creates in `refs`

const mageWithOneDragon = mage(dragon());

// Seed composed state

await seed(mageWithOneDragon);
```

See tests folder for more examples.

---

## Modelling References

This module does not currently support using [`ref`](https://mongoosejs.com/docs/api.html#schematype_SchemaType-ref) to populate references in the composed tree. To achieve correct population of refs provide a data structure of type [`Ref[]`](#Ref) to [`model()`](#methodstates).

---

## API

### **Functions**

#### `model(mongooseModel, [refs])`

- mongooseModel: mongoose.Model (required) - A mongoose model.
- refs: Array\<[Ref](#Ref)\> (optional) - List of `Ref` objects used to provide references to other models.

Returns - `method`

#### `<method>([...states])`

- states: Array\<[State](#State)\> (optional) - List of `State` objects returned previous calls of `method()`.

Returns - `State`

#### `seed(state)`

Seed documents created using `method()`.

- state: [State](#State) (required) - State tree created by `method()` calls.

Returns - `Promise<State>`

Examples - [tests/seed.test.ts](tests/seed.test.ts)

#### `cleanup(state)`

Delete documents seeded using `seed()`.

- state: [State](#State) (required) - State tree created by `method()` calls.

Returns - `Promise<void>`

Examples - [tests/cleanup.test.ts](tests/cleanup.test.ts)

#### `patch(state, patches)`

Modify values of a document created using `method()`.

- state: [State](#State) (required) - State tree created by `method()` calls.
- patches: Record<string, any> - Key-value pair of mongoose dot notation paths and the value to be set.

Returns - `State`

Examples - [tests/patch.test.ts](tests/patch.test.ts)

### **Types**

#### `Ref`

Used for modelling references between models.

- model: mongoose.Model (required)
- keys: Array (required)
  - key: String - Field on current model
  - model: mongoose.Model - Foreign model

#### `State`

This is state maintained by the module and should not be interacted with directly.

---

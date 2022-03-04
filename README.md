# `seedmongoose`

Composable seeding for mongoose models.

## Example

```
import { model, seed } from "seedmongoose";

// Create models
const MageSchema = new mongoose.Schema({ /* ... */ });
const MageModel = mongoose.model("mages", MageSchema);

const DragonSchema = new mongoose.Schema({ /* ... */ });
const DragonModel = mongoose.model("dragons", DragonSchema);

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

// Compose a method for one dragon document
// with mageId == parent mage's _id
const mageWithOneDragon = mage(dragon());

// Seed composed method
await seed(mageWithOneDragon);
```

See tests folder for more examples.

---

## API

### **Functions**

#### `model(mongooseModel, [refs])`

* mongooseModel: mongoose.Model (required) - A mongoose model.
* refs: Array\<[Ref](#Ref)\> (optional) - List of `Ref` objects used to provide references to other models.

Returns - `method`

#### `method([...states])`

* states: Array\<[State](#State)\> (optional) - List of `State` objects returned previous calls of `method()`.

Returns - `State`

#### `seed(state)`

* state: [State](#State) (required) - State tree created by `method()` calls.

Returns - `Promise<State>`

### **Types**

#### `Ref`

* model: mongoose.Model (required)
* keys: Array (required)
    * key: String - Field on current model
    * model: mongoose.Model - Foreign model

#### `State`

This is state maintained by the module and should not be interacted with directly.

---
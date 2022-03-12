# `seedrgoose`

Composable seeding for mongoose models.

## Example

```
import { model, seed } from "seedrgoose";
import mongoose from "mongoose";

// Create models

const MageSchema = new mongoose.Schema({ /* ... */ });
const MageModel = mongoose.model("mages", MageSchema);

const DragonSchema = new mongoose.Schema({
    mageId: mongoose.Types.ObjectId,
    /* ... */
});
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

---

## Modelling References

This module does not currently support using [`ref`](https://mongoosejs.com/docs/api.html#schematype_SchemaType-ref) to populate references in the composed tree. To achieve correct population of refs provide a data structure of type [`Ref[]`](#Ref) to [`model()`](#methodstates).

## Modelling some common use cases

### Single reference from one model to another

```
const mongoose = require("mongoose");
const { model } = require("seedrgoose");

const UserModel = mongoose.model(
    "users",
    new mongoose.Schema({ teamId: mongoose.Types.ObjectId, /* ... */})
);
const TeamModel = mongoose.model(
    "teams",
    new mongoose.Schema({ /* ... */ })
);

const Refs = [
    { model: UserModel, keys: [{ key: "teamId", model: TeamModel }] },
    { model: TeamModel, keys: [] }
];

const user = model(UserModel, Refs);
const team = model(TeamModel, Refs);

// Models 1 TeamModel document and
// 3 UserModel documents where teamId
// on all 3 UserModel documents will be
// the _id of the single TeamModel document
const teamWithThreeUsers = team(
    user(),
    user(),
    user()
);
```

### Array of references from one model to another

```
const mongoose = require("mongoose");
const { model } = require("seedrgoose");

const UserModel = mongoose.model(
    "users",
    new mongoose.Schema({ /* ... */})
);
const TeamModel = mongoose.model(
    "teams",
    new mongoose.Schema({ users: [mongoose.Types.ObjectId], /* ... */ })
);

const Refs = [
    { model: UserModel, keys: [] },
    { model: TeamModel, keys: [{ key: ["users"], model: UserModel }] }
];

const user = model(UserModel, Refs);
const team = model(TeamModel, Refs);

// Models 1 TeamModel document and
// 3 UserModel documents where the users
// array on the TeamModel document
// will contain the _id's of the
// 3 UserModel documents
const teamWithThreeUsers = team(
    user(),
    user(),
    user()
);
```

### Reference inside a subdocument array

```
const mongoose = require("mongoose");
const { model } = require("seedrgoose");

const UserModel = mongoose.model(
    "users",
    new mongoose.Schema({
        activities: [
            {
                timestamp: {
                    type: Date,
                    default: Date.now
                },
                activityId: mongoose.Types.ObjectId
            }
        ],
        /* ... */
    })
);
const ActivityModel = mongoose.model(
    "activities",
    new mongoose.Schema({ subscription: [mongoose.Types.ObjectId], /* ... */ })
);

const Refs = [
    { model: UserModel, keys: [{ key: ["activities.activityId"], model: ActivityModel }] },
    { model: ActivityModel, keys: [] }
];

const user = model(UserModel, Refs);
const activity = model(ActivityModel, Refs);

// This will populate activities array
// on the user with 3 documents with their
// defaults, i.e. timestamp, populated.
const userWithThreeActivities = user(
    activity(),
    activity(),
    activity()
);
```

### References to documents 2 or more levels above in the hierarchy.

```
const mongoose = require("mongoose");
const { model } = require("seedrgoose");

const TeamModel = mongoose.model(
    "teams",
    new mongoose.Schema({ /* ... */ })
);
const UserModel = mongoose.model(
    "users",
    new mongoose.Schema({
        teamId: mongoose.Types.ObjectId,
        /* ... */
    })
);
const ActivityModel = mongoose.model(
    "activities",
    new mongoose.Schema({
        userId: mongoose.Types.ObjectId,
        teamId: mongoose.Types.ObjectId,
        /* ... */
    })
);

const Refs = [
    {
        model: TeamModel,
        keys:
            { key: ["users"], model: UserModel }
        ]
    },
    {
        model: UserModel,
        keys: [
            { key: "teamId", model: TeamModel },
        ]
    },
    {
        model: ActivityModel,
        keys: [
            { key: "userId", model: UserModel },
            { key: "teamId", model: TeamModel },
        ]
    }
];

const user = model(UserModel, Refs);
const team = model(TeamModel, Refs);
const activity = model(ActivityModel, Refs);

// Models a team with 2 users
// and an activity document for each user.
const teamWithASingleUserAndTwoActivities =
    team( // teamA
        user( // userA - will have teamId of teamA
            activity() // userId and teamId will of userA
        ),
        user( // userB - will have teamId of teamA
            activity() // userId and teamId will be of userB
        )
    );
```

### Customizing fields on documents

```
const mongoose = require("mongoose");
const faker = require("faker");
const { model } = require("seedrgoose");

const UserModel = mongoose.model(
    "users",
    new mongoose.Schema({
        username: String,
        firstName: String,
        lastName: String,
        teamId: mongoose.Types.ObjectId,
        /* ... */
    })
);
const TeamModel = mongoose.model(
    "teams",
    new mongoose.Schema({
        name: String,
        /* ... */
    })
);

const Refs = [
    { model: TeamModel, keys: [] },
    { model: UserModel, keys: [{ key: "teamId", model: TeamModel }] }
];

const user = model(UserModel, Refs);
const team = model(TeamModel, Refs);

const teamWithTwoModifiedUsers = team(
    patch(
        user(),
        {
            username: faker.internet.email(),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
        }
    ),
    patch(
        user(),
        {
            username: faker.internet.email(),
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
        }
    ),
);
```

### I need to access a reference from a document in the state tree that I am building

You can do this in two ways - Before or after seeding.

**Before seeding**: Since the documents are not created by seedrgoose until `seed()` is called you can use `patch()` to set generated ObjectId's.

```
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose");
const { model, patch } = require("seedrgoose");

const UserModel = mongoose.model(
    "users",
    new mongoose.Schema({ teamId: mongoose.Types.ObjectId, /* ... */})
);
const TeamModel = mongoose.model(
    "teams",
    new mongoose.Schema({ users: [mongoose.Types.ObjectId], /* ... */ })
);

const Refs = [
    { model: UserModel, keys: [{ key: "teamId", model: TeamModel }] },
    { model: TeamModel, keys: [{ key: ["users"], model: UserModel }] }
];

const user = model(UserModel, Refs);
const team = model(TeamModel, Refs);

const teamId = new ObjectId();

const teamWithAUser = patch(
    team(
        user(), // teamId on this document will be populated with the patched _id
    ),
    { _id: teamId }
);

const userId = new ObjectId();

const teamWithAUser = team( // users array will be populated with the patched `userId`
    patch(user(), { _id: userId }),
);
```

**After seeding**: The resolution value of `seed()` can be passed into `documents()` to get a tree of documents created.

```
const mongoose = require("mongoose");
const { ObjectId } = require("mongoose");
const { model, seed, documents } = require("seedrgoose");

const UserModel = mongoose.model(
    "users",
    new mongoose.Schema({ teamId: mongoose.Types.ObjectId, /* ... */})
);
const TeamModel = mongoose.model(
    "teams",
    new mongoose.Schema({ users: [mongoose.Types.ObjectId], /* ... */ })
);

const Refs = [
    { model: UserModel, keys: [{ key: "teamId", model: TeamModel }] },
    { model: TeamModel, keys: [{ key: ["users"], model: UserModel }] }
];

const user = model(UserModel, Refs);
const team = model(TeamModel, Refs);

const teamWithAUser = documents(await seed(team(user())));
teamWithUser.collection // "teams"
teamWithUser.document // team document
teamWithUser.children[0].collection // "users"
teamWithUser.children[0].document // user document
```

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
- patches: Record\<string, any\> - Key-value pair of mongoose dot notation paths and the value to be set.

Returns - `State`

Examples - [tests/patch.test.ts](tests/patch.test.ts)

#### `documents(state)`

Get document tree from result of seed().

- state: [State](#State) (required) - State tree returned by `seed()`

Returns - `DocumentTree`

### **Types**

#### `Ref`

Used for modelling references between models.

- model: mongoose.Model (required)
- keys: Array (required)
  - key: string | string[] - Field on current model. Use `string[]` when you want to model array of ids or array of subdocuments with keys that have foreign references.
  - model: mongoose.Model - Foreign model

#### `DocumentTree`

- document: mongoose.Document
- children: DocumentTree[]

#### `State`

This is state maintained by the module and should not be interacted with directly.

---

// Fixed word list — random word picked from here each turn.
// Each entry has a `word` and 2-3 `clues` — short, non-obvious sentences
// that never contain the word itself. Clues are shown to the guesser one
// at a time, cycling in a loop, alongside the letter-blank hint tiles.
const WORD_LIST = [
  // Objects
  { word: "chair", clues: ["You sit on it.", "Every dining table needs a few.", "It can have four legs or one wheel."] },
  { word: "umbrella", clues: ["It opens up above your head.", "You need it when it rains.", "It folds away when not in use."] },
  { word: "guitar", clues: ["It has strings you pluck.", "Rockstars love holding it.", "It comes in acoustic and electric versions."] },
  { word: "bicycle", clues: ["It has two wheels.", "You pedal to move it.", "No fuel needed, just leg power."] },
  { word: "clock", clues: ["It tells you the time.", "It has hands that move in circles.", "You hang it on a wall or wear it."] },
  { word: "candle", clues: ["It melts as it burns.", "People blow it out on birthdays.", "It gives light without electricity."] },
  { word: "ladder", clues: ["You climb it to reach high places.", "Painters and electricians use it a lot.", "It has rungs, not steps."] },
  { word: "key", clues: ["It unlocks doors.", "You usually carry it in your pocket.", "Losing it means you're locked out."] },
  { word: "hammer", clues: ["It's used to drive nails.", "It has a heavy head and a handle.", "Thor famously carries one."] },
  { word: "scissors", clues: ["It has two blades that cross.", "You use it to cut paper.", "It needs two fingers in the handles."] },
  { word: "backpack", clues: ["Students carry it to school.", "You wear it on your shoulders.", "It holds books, laptops, or snacks."] },
  { word: "camera", clues: ["It captures a moment forever.", "It has a lens that opens and closes.", "You say cheese before it clicks."] },
  { word: "telephone", clues: ["You use it to talk to someone far away.", "Old ones had a spinning dial.", "It rings when someone calls."] },
  { word: "lamp", clues: ["It lights up a room.", "You often keep it on a study table.", "It has a switch and a bulb."] },
  { word: "mirror", clues: ["It shows your reflection.", "It's usually made of glass.", "Breaking it is said to bring bad luck."] },
  { word: "suitcase", clues: ["You pack clothes inside it for a trip.", "It usually has wheels and a handle.", "Airports are full of these."] },
  { word: "helmet", clues: ["It protects your head.", "Bikers and cricketers wear it.", "It's mandatory while riding a two-wheeler."] },
  { word: "glasses", clues: ["You wear them to see better.", "They sit on your nose and ears.", "Some people need them just for reading."] },
  { word: "wallet", clues: ["You keep money and cards in it.", "It fits in your pocket.", "Losing it ruins your whole day."] },
  { word: "shoe", clues: ["You wear it on your foot.", "It comes in pairs.", "Sneakers and sandals are types of it."] },

  // Animals
  { word: "elephant", clues: ["It's the largest land animal.", "It has a long trunk.", "It never forgets, they say."] },
  { word: "penguin", clues: ["It's a bird that can't fly.", "It waddles on ice.", "It wears a natural black-and-white 'suit'."] },
  { word: "octopus", clues: ["It has eight arms.", "It lives underwater and can change color.", "It squirts ink when scared."] },
  { word: "kangaroo", clues: ["It carries its baby in a pouch.", "It hops instead of walking.", "It's found mostly in Australia."] },
  { word: "butterfly", clues: ["It starts life as a caterpillar.", "It has colorful, delicate wings.", "It flutters from flower to flower."] },
  { word: "spider", clues: ["It has eight legs.", "It spins a web to catch food.", "Many people are scared of it."] },
  { word: "parrot", clues: ["It's a bird that can mimic speech.", "It's often green with a curved beak.", "People keep it as a talking pet."] },
  { word: "dolphin", clues: ["It's a smart sea mammal.", "It communicates with clicks and whistles.", "It's known for jumping out of water."] },
  { word: "crocodile", clues: ["It lurks in rivers and swamps.", "It has a long snout full of teeth.", "It can stay still for a very long time."] },
  { word: "peacock", clues: ["It's known for its colorful tail feathers.", "The male fans out its feathers to attract mates.", "It's a national bird in some countries."] },
  { word: "camel", clues: ["It stores fat in its hump.", "It can survive long without water.", "It's called the ship of the desert."] },
  { word: "squirrel", clues: ["It has a big bushy tail.", "It loves collecting nuts.", "It's often seen climbing trees quickly."] },
  { word: "owl", clues: ["It's active mostly at night.", "It can rotate its head almost all the way around.", "It's often seen as a symbol of wisdom."] },
  { word: "snail", clues: ["It carries its home on its back.", "It moves extremely slowly.", "It leaves a slimy trail behind."] },
  { word: "goat", clues: ["It has small horns and a beard.", "It eats almost anything, even paper.", "It gives us milk and sometimes wool."] },

  // Food
  { word: "pizza", clues: ["It's a round dish topped with cheese.", "It's baked in an oven.", "It's usually cut into triangle slices."] },
  { word: "burger", clues: ["It has a patty between two buns.", "It's a popular fast food item.", "It often comes with fries."] },
  { word: "ice cream", clues: ["It's a frozen, sweet dessert.", "It melts quickly in the sun.", "It comes in a cone or a cup."] },
  { word: "banana", clues: ["It's a curved yellow fruit.", "Monkeys love eating it.", "You peel it before eating."] },
  { word: "watermelon", clues: ["It's a big green fruit with red inside.", "It's mostly water and very refreshing.", "It has lots of black seeds."] },
  { word: "samosa", clues: ["It's a fried triangular snack.", "It's usually stuffed with spiced potatoes.", "It's a favorite with evening chai."] },
  { word: "mango", clues: ["It's called the king of fruits.", "It's sweet, juicy, and orange-yellow inside.", "Summer is famous for this fruit."] },
  { word: "noodles", clues: ["It's long, thin strands of dough.", "It's usually cooked in a soup or stir-fry.", "Kids love the instant version."] },
  { word: "pancake", clues: ["It's a flat, round breakfast dish.", "It's often topped with syrup.", "You stack a few of them on a plate."] },
  { word: "donut", clues: ["It's a fried, sweet ring-shaped snack.", "It's often glazed or covered in sprinkles.", "It has a hole in the middle."] },
  { word: "cupcake", clues: ["It's a small cake baked in a single serving.", "It usually has frosting swirled on top.", "It's basically a mini version of a bigger dessert."] },
  { word: "chili", clues: ["It's small but packs a lot of heat.", "It's usually red or green.", "It makes food spicy."] },
  { word: "coconut", clues: ["It has a hard brown shell.", "It's full of water when young.", "It grows on tall trees near the coast."] },
  { word: "pineapple", clues: ["It has a spiky crown on top.", "It's yellow and very juicy inside.", "Its outside looks rough and textured."] },

  // Nature
  { word: "mountain", clues: ["It's a huge natural elevation of land.", "Climbers try to reach its peak.", "Some have snow at the top all year."] },
  { word: "volcano", clues: ["It can erupt with lava.", "It's shaped like a cone-shaped mountain.", "It's extremely dangerous when active."] },
  { word: "rainbow", clues: ["It appears in the sky after rain.", "It has seven colors.", "It's shaped like an arc."] },
  { word: "waterfall", clues: ["It's water falling from a height.", "It creates a loud, rushing sound.", "Rivers often form these on rocky terrain."] },
  { word: "tornado", clues: ["It's a spinning column of air.", "It can destroy houses in seconds.", "It's shaped like a funnel."] },
  { word: "island", clues: ["It's land surrounded by water on all sides.", "You usually need a boat or plane to reach it.", "Some are so small only one house fits."] },
  { word: "desert", clues: ["It's extremely dry with little rainfall.", "It's often covered in sand.", "Camels are commonly found here."] },
  { word: "cactus", clues: ["It's a spiky plant.", "It can survive with very little water.", "It's common in deserts."] },
  { word: "lightning", clues: ["It's a bright flash during a storm.", "It's followed by thunder.", "It can strike really fast and is dangerous."] },
  { word: "snowman", clues: ["Kids build it in winter.", "It's made of rolled-up snowballs.", "It often has a carrot for a nose."] },
  { word: "campfire", clues: ["It's a fire built outdoors at night.", "People sit around it and tell stories.", "It's common on camping trips."] },
  { word: "cloud", clues: ["It floats in the sky.", "It's made of tiny water droplets.", "It can bring rain when it gets heavy."] },

  // Actions/concepts
  { word: "dancing", clues: ["It's moving your body to music.", "It can be slow or fast.", "People do it at weddings and parties."] },
  { word: "sleeping", clues: ["It's what you do at night to rest.", "Your eyes are closed while doing it.", "Everyone needs about 8 hours of it."] },
  { word: "swimming", clues: ["You do it in water.", "It's a full-body exercise.", "Pools and rivers are common places for it."] },
  { word: "flying", clues: ["Birds and planes do this.", "It means moving through the air.", "You need wings or an engine for it."] },
  { word: "laughing", clues: ["It happens when something is funny.", "It's often loud and uncontrollable.", "It's a sign you're enjoying yourself."] },
  { word: "sneezing", clues: ["It happens suddenly through your nose.", "Dust or pepper can trigger it.", "People often say 'bless you' after it."] },
  { word: "juggling", clues: ["It involves keeping several objects in the air.", "Circus performers are known for this.", "It takes a lot of hand-eye coordination."] },
  { word: "climbing", clues: ["It means going upward using your hands and feet.", "Mountaineers do a lot of this.", "It can be done on rocks, walls, or trees."] },
  { word: "fishing", clues: ["It involves a rod and a hook.", "You wait patiently near water for this.", "The goal is to catch something from the water."] },
  { word: "singing", clues: ["It's making music with your voice.", "People do it in the shower a lot.", "Reality shows are full of this talent."] },

  // Fantasy/fun
  { word: "dragon", clues: ["It's a mythical creature that breathes fire.", "It often has wings and scales.", "It's usually the villain guarding treasure."] },
  { word: "robot", clues: ["It's a machine that can perform tasks.", "It's often controlled by a computer program.", "Sci-fi movies are full of these."] },
  { word: "ghost", clues: ["It's said to be the spirit of someone who died.", "It's often shown as a white see-through figure.", "It's the star of most horror stories."] },
  { word: "alien", clues: ["It's said to come from another planet.", "It's often shown with big eyes and green skin.", "UFOs are supposedly piloted by these."] },
  { word: "wizard", clues: ["It's a person who practices magic.", "It usually carries a wand or staff.", "It often wears a pointy hat and long robe."] },
  { word: "mermaid", clues: ["It's half human, half fish.", "It lives in the ocean.", "It's a popular character in fairy tales."] },
  { word: "dinosaur", clues: ["It went extinct millions of years ago.", "It was often huge in size.", "Fossils are how we know about it."] },
  { word: "superhero", clues: ["It usually has special powers.", "It often wears a cape or mask.", "It's always saving the world from villains."] },
  { word: "zombie", clues: ["It's said to be the walking dead.", "It moves slowly and groans a lot.", "It's a horror movie favorite."] },
  { word: "ninja", clues: ["It's a stealthy warrior from Japanese folklore.", "It moves silently and often wears black.", "It's skilled in martial arts and sneaking around."] },

  // Everyday India-relatable
  { word: "auto rickshaw", clues: ["It's a three-wheeled vehicle for short rides.", "It's common in Indian cities.", "It has a meter, though drivers rarely use it."] },
  { word: "cricket bat", clues: ["It's used to hit a ball in a popular sport.", "It's made of wood, usually willow.", "Every Indian kid has swung one in a gully."] },
  { word: "kite", clues: ["It flies high on a string.", "Festivals are dedicated to flying these.", "Its string is sometimes coated with glass powder."] },
  { word: "temple", clues: ["It's a place of worship.", "It often has a tall spire or dome.", "Bells and incense are common here."] },
  { word: "chai cup", clues: ["It holds a hot, milky drink.", "It's often small and made of clay or steel.", "Roadside stalls serve this constantly."] },
  { word: "train", clues: ["It runs on tracks.", "It has many connected compartments.", "It's one of the most common ways to travel long distance."] },
  { word: "fan", clues: ["It spins to cool a room.", "It's usually mounted on the ceiling.", "It becomes essential in summer."] },
  { word: "bucket", clues: ["It's used to carry or store water.", "It's usually made of plastic.", "It's a bathroom essential in many homes."] },
  { word: "slipper", clues: ["It's worn on your feet at home.", "It's easy to slip on and off.", "You often leave it outside the door."] },
  { word: "phone charger", clues: ["It's plugged into a wall socket.", "It refills your phone's battery.", "Losing it causes minor daily panic."] },
];

function getRandomWord(excludeList = []) {
  const available = WORD_LIST.filter(w => !excludeList.includes(w.word));
  const pool = available.length > 0 ? available : WORD_LIST;
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return entry.word; // game.js and the rest of the app only ever deal with plain word strings
}

// Looks up the clue list for a given word string (used when only the
// word text is on hand, e.g. after Game.js stores it as a plain string).
function getCluesForWord(word) {
  const entry = WORD_LIST.find(w => w.word === word);
  return entry ? entry.clues : [];
}

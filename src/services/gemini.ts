import { GoogleGenAI, Type } from "@google/genai";
import { MacroEstimation, Recipe, UserProfile, Meal, RecipeFilters, WeeklyReport, AminoAcidProfile, ProteinQualityAnalysis, MicronutrientProfile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorString = JSON.stringify(error).toLowerCase();
    const isQuotaError = 
      errorString.includes("429") || 
      errorString.includes("resource_exhausted") || 
      errorString.includes("quota exceeded") ||
      (error.message && error.message.toLowerCase().includes("quota"));

    if (retries > 0 && isQuotaError) {
      console.warn(`MacroLog AI: Quota exceeded, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const estimateAminoAcids = async (items: string[]): Promise<AminoAcidProfile> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Estimate the total amino acid profile (in grams) for the following food items: ${JSON.stringify(items)}. 
      Focus on the 9 essential amino acids: leucine, isoleucine, valine, lysine, methionine, phenylalanine, threonine, tryptophan, histidine.
      Also include: arginine, cysteine, tyrosine, glycine, proline, serine, alanine, asparticAcid, glutamicAcid.
      Return ONLY a JSON object representing the AminoAcidProfile.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            leucine: { type: Type.NUMBER },
            isoleucine: { type: Type.NUMBER },
            valine: { type: Type.NUMBER },
            lysine: { type: Type.NUMBER },
            methionine: { type: Type.NUMBER },
            phenylalanine: { type: Type.NUMBER },
            threonine: { type: Type.NUMBER },
            tryptophan: { type: Type.NUMBER },
            histidine: { type: Type.NUMBER },
            arginine: { type: Type.NUMBER },
            cysteine: { type: Type.NUMBER },
            tyrosine: { type: Type.NUMBER },
            glycine: { type: Type.NUMBER },
            proline: { type: Type.NUMBER },
            serine: { type: Type.NUMBER },
            alanine: { type: Type.NUMBER },
            asparticAcid: { type: Type.NUMBER },
            glutamicAcid: { type: Type.NUMBER }
          }
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};

export const parseMealInput = async (description: string): Promise<{ cleanedName: string, items: string[] }> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this meal description: "${description}". 
      1. Provide a proper, clean, and descriptive combined name for the meal.
      2. Split the meal into individual food items with their quantities/portions.
      Return ONLY a JSON object with keys: cleanedName (string), items (array of strings).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleanedName: { type: Type.STRING },
            items: { type: Type.ARRAY, items: { type: Type.STRING } }
          },
          required: ["cleanedName", "items"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
};

export interface ParsedItemMacro {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export const estimateItemsMacros = async (items: string[]): Promise<ParsedItemMacro[]> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Estimate calories, protein, carbs, and fat for each of the following food items: ${JSON.stringify(items)}. 
      Return an array of JSON objects, each with keys: name (string), calories (number), protein (number), carbs (number), fat (number).`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              calories: { type: Type.NUMBER },
              protein: { type: Type.NUMBER },
              carbs: { type: Type.NUMBER },
              fat: { type: Type.NUMBER }
            },
            required: ["name", "calories", "protein", "carbs", "fat"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  });
};

export const analyzeMealImagesForItems = async (base64Images: string[]): Promise<{ cleanedName: string, items: string[], confidenceScore: number, macros: MacroEstimation }> => {
  return withRetry(async () => {
    const prompt = "Analyze all provided images together. Identify every visible ingredient, nutrition label, or packaged food. Combine all detected foods into one meal. Estimate total calories, protein, carbohydrates, and fat. If a nutrition label exists in one of the images, prioritize it for macro accuracy. Return a proper, clean combined name for the meal, a list of individual food items with their quantities, the total estimated macros, and a confidence score (0-100) based on how clearly you can identify the items and portions.";

    const imageParts = base64Images.map(img => ({
      inlineData: {
        mimeType: "image/jpeg", 
        data: img.split(',')[1] || img
      }
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        ...imageParts,
        { text: prompt }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cleanedName: { type: Type.STRING },
            items: { type: Type.ARRAY, items: { type: Type.STRING } },
            confidenceScore: { type: Type.NUMBER },
            macros: {
              type: Type.OBJECT,
              properties: {
                calories: { type: Type.NUMBER },
                protein: { type: Type.NUMBER },
                carbs: { type: Type.NUMBER },
                fat: { type: Type.NUMBER }
              },
              required: ["calories", "protein", "carbs", "fat"]
            }
          },
          required: ["cleanedName", "items", "confidenceScore", "macros"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  });
};

export const generateRecipesFromPantry = async (
  ingredients: string[], 
  filters: RecipeFilters, 
  profile: UserProfile,
  remainingMacros?: MacroEstimation
): Promise<Recipe[]> => {
  return withRetry(async () => {
    const macroContext = remainingMacros 
      ? `The user has ${remainingMacros.calories}kcal, ${remainingMacros.protein}g protein, ${remainingMacros.carbs}g carbs, and ${remainingMacros.fat}g fat remaining for the day. Prioritize recipes that fit these targets.`
      : `The user's goal is ${profile.fitnessGoal}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `I have the following ingredients: ${ingredients.join(", ")}. 
      Generate 3 healthy recipes I can cook.
      
      Filters:
      - Dietary: ${filters.dietary.join(", ") || "None"}
      - Cuisine: ${filters.cuisine || "Any"}
      - Max Prep Time: ${filters.maxTime} minutes
      - Meal Category: ${filters.mealType || "Standard Meal"}
      - Additional Instructions: ${filters.customInstructions || "None"}
      
      Context:
      ${macroContext}
      
      Return a JSON array of objects with:
      - title (string)
      - ingredients (array of strings with measurements)
      - instructions (array of strings)
      - macros (object with calories, protein, carbs, fat)
      - prepTime (string, e.g. "25 mins")
      - mealPrepTips (string, optional)
      - substitutions (array of strings, optional)
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              macros: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER }
                }
              },
              prepTime: { type: Type.STRING },
              mealPrepTips: { type: Type.STRING },
              substitutions: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "ingredients", "instructions", "macros", "prepTime"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  });
};

export const getWeeklyCoaching = async (profile: UserProfile, meals: Meal[]): Promise<string> => {
  return withRetry(async () => {
    const mealSummary = meals.map(m => `${m.timestamp}: ${m.description} (${m.calories}kcal, P:${m.protein}g)`).join("\n");
    
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a professional dietitian. Analyze the following 7-day nutrition data for a user with goal: ${profile.fitnessGoal}. 
      User Profile: Age ${profile.age}, Weight ${profile.weight}kg, Height ${profile.height}cm.
      Targets: ${profile.calorieTarget}kcal, ${profile.proteinTarget}g Protein.
      
      Meal Data:
      ${mealSummary}
      
      Provide a concise, actionable summary (max 200 words) like a dietitian would. Focus on consistency, protein intake, and progress towards their goal.`,
      config: {
        systemInstruction: "You are a helpful AI Nutrition Coach. Be encouraging but data-driven."
      }
    });

    return response.text || "Unable to generate coaching summary at this time.";
  });
};

export const chatWithAssistant = async (message: string, context: { profile: UserProfile, pantry: string[], todayMeals: Meal[] }) => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User: ${message}
      
      Context:
      - Goal: ${context.profile.fitnessGoal}
      - Pantry: ${context.pantry.join(", ")}
      - Today's Meals: ${context.todayMeals.map(m => m.description).join(", ")}`,
      config: {
        systemInstruction: "You are MacroLog AI, a personal nutrition assistant. Help the user with meal ideas, macro advice, and nutrition questions. Keep responses concise and actionable."
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";
  });
};

export const getMealSuggestions = async (remaining: MacroEstimation, profile: UserProfile): Promise<Recipe[]> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `The user has the following macros remaining for today: 
      Calories: ${remaining.calories}kcal, Protein: ${remaining.protein}g, Carbs: ${remaining.carbs}g, Fat: ${remaining.fat}g.
      User Goal: ${profile.fitnessGoal}.
      
      Suggest 3-5 meal ideas that help the user reach these targets. 
      Focus on filling the gaps (e.g., if protein is low, suggest high-protein meals).
      
      Return a JSON array of objects with:
      - title (string)
      - ingredients (array of strings)
      - instructions (array of strings)
      - macros (object with calories, protein, carbs, fat)
      - prepTime (string)
      `,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              ingredients: { type: Type.ARRAY, items: { type: Type.STRING } },
              instructions: { type: Type.ARRAY, items: { type: Type.STRING } },
              macros: {
                type: Type.OBJECT,
                properties: {
                  calories: { type: Type.NUMBER },
                  protein: { type: Type.NUMBER },
                  carbs: { type: Type.NUMBER },
                  fat: { type: Type.NUMBER }
                }
              },
              prepTime: { type: Type.STRING }
            },
            required: ["title", "ingredients", "instructions", "macros", "prepTime"]
          }
        }
      }
    });

    return JSON.parse(response.text || "[]");
  });
};

export const getWeeklyInsights = async (reportData: Partial<WeeklyReport>, profile: UserProfile): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this weekly nutrition report for a user with goal: ${profile.fitnessGoal}.
      Averages: ${reportData.avgCalories}kcal, ${reportData.avgProtein}g Protein, ${reportData.avgCarbs}g Carbs, ${reportData.avgFat}g Fat.
      Avg Diet Score: ${reportData.avgDietScore}/100.
      Targets Met: Protein ${reportData.daysProteinTargetMet}/7 days, Calories ${reportData.daysCalorieTargetMet}/7 days.
      Best Score: ${reportData.bestDietScore}, Worst Score: ${reportData.worstDietScore}.
      
      Provide 2-3 concise, actionable insights or encouraging comments.`,
      config: {
        systemInstruction: "You are a professional AI Nutrition Coach. Be concise, data-driven, and encouraging."
      }
    });

    return response.text || "Keep up the great work!";
  });
};

export const getAminoAcidInsights = async (profile: UserProfile, aminoAcids: any, totalProtein: number): Promise<string> => {
  console.log("MacroLog AI: Generating AA insights for protein:", totalProtein);
  if (!aminoAcids || Object.keys(aminoAcids).length === 0 || totalProtein <= 0) {
    console.warn("MacroLog AI: Insufficient data for AA insights");
    return "Not enough protein data to generate amino acid insights. Log more protein-rich foods to see detailed analysis.";
  }

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this amino acid profile for a user with goal: ${profile.fitnessGoal || 'general health'}.
      Total Protein: ${totalProtein}g.
      Amino Acids: ${JSON.stringify(aminoAcids)}.
      
      Provide a concise nutritional insight and recommendation. Mention if any essential amino acids are low and suggest foods to improve balance.`,
      config: {
        systemInstruction: "You are a professional AI Nutritionist. Be concise and data-driven."
      }
    });

    const text = response.text;
    console.log("MacroLog AI: AA insights generated successfully");
    return text || "Your amino acid profile looks balanced.";
  });
};

export const estimateMicronutrients = async (foodDescription: string, amountGrams: number): Promise<MicronutrientProfile> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Estimate the micronutrient content for ${amountGrams}g of ${foodDescription}. 
      Return ONLY a JSON object with the following keys (if present):
      vitaminA (mcg), vitaminB1 (mg), vitaminB2 (mg), vitaminB3 (mg), vitaminB5 (mg), vitaminB6 (mg), vitaminB9 (mcg), vitaminB12 (mcg), vitaminC (mg), vitaminD (mcg), vitaminE (mg), vitaminK (mcg),
      calcium (mg), iron (mg), magnesium (mg), phosphorus (mg), potassium (mg), sodium (mg), zinc (mg), copper (mg), manganese (mg), selenium (mcg), iodine (mcg).
      Use standard nutritional values. If a nutrient is negligible, omit it or set to 0.`,
      config: {
        responseMimeType: "application/json",
      },
    });

    try {
      return JSON.parse(response.text.trim()) as MicronutrientProfile;
    } catch (e) {
      console.error("Failed to parse micronutrient estimation:", e);
      return {};
    }
  });
};

export const getMicronutrientInsights = async (profile: UserProfile, micronutrients: MicronutrientProfile, targets: MicronutrientProfile): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze this daily micronutrient intake for a user with goal: ${profile.fitnessGoal}.
      Intake: ${JSON.stringify(micronutrients)}
      Targets: ${JSON.stringify(targets)}
      
      Provide 2-3 concise, actionable insights. Highlight any significant deficiencies or imbalances (e.g. sodium vs potassium) and suggest specific foods to improve.`,
      config: {
        systemInstruction: "You are a professional AI Nutritionist. Be concise, data-driven, and actionable."
      }
    });

    return response.text || "Your micronutrient intake looks balanced today.";
  });
};

export const getDetailedProteinQuality = async (items: string[], aminoAcids: AminoAcidProfile, totalProtein: number): Promise<ProteinQualityAnalysis> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `You are a nutrition science engine that calculates protein quality for foods and meals. 
      Input Items: ${JSON.stringify(items)}
      Amino Acid Profile: ${JSON.stringify(aminoAcids)}
      Total Protein: ${totalProtein}g
      
      Tasks:
      1. Analyze the amino acid profile. Compare the essential amino acids to the WHO/FAO/UNU adult reference pattern.
      2. Calculate the Digestible Indispensable Amino Acid Score (DIAAS) if data is available; otherwise, use PDCAAS.
      3. Adjust for digestibility, cooking, processing, and anti-nutrients based on the input items.
      4. Output a Protein Quality Score (0–100%), and assign a tier:
         90–100 → High Quality Protein
         70–89 → Moderate Quality Protein
         <70 → Low Quality Protein
      5. For mixed meals, calculate the weighted score based on protein content per ingredient.
      6. Highlight limiting amino acids if present and provide suggestions to improve protein quality.
      
      Return ONLY a JSON object with:
      {
        "proteinQualityScore": number,
        "rating": string,
        "limitingAminoAcids": string[],
        "comments": string
      }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            proteinQualityScore: { type: Type.NUMBER },
            rating: { type: Type.STRING },
            limitingAminoAcids: { type: Type.ARRAY, items: { type: Type.STRING } },
            comments: { type: Type.STRING }
          },
          required: ["proteinQualityScore", "rating", "limitingAminoAcids", "comments"]
        }
      }
    });

    return JSON.parse(response.text || "{}");
  });
};

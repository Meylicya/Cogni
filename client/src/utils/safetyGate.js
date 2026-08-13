export const checkSafetyGate = (injuryTimestamp) => {
    if (!injuryTimestamp) {
        return { safe: false, message: "Please provide an injury date." };
    }

    const injuryDate = new Date(injuryTimestamp).getTime();
    const now = Date.now();
    const hoursSinceInjury = (now - injuryDate) / (1000 * 60 * 60);

    // The app must block cognitive exercises if <48 hrs have passed
    if (hoursSinceInjury < 48) {
        return { 
            safe: false, 
            message: "Safety Gate Active: Patient is in the acute phase (<48 hours since injury). Exercises are blocked. Please advise rest." 
        };
    }
    
    return { 
        safe: true, 
        message: "Safety Gate Passed: Patient is cleared for sub-acute cognitive rehabilitation." 
    };
}

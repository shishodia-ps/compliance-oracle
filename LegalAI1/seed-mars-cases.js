// Using native Node 18+ fetch

const cases = [
    {
        appellantName: "Elena Rostova",
        visaType: "FAMILY_REUNIFICATION",
        denialText: `Decision of the Mars Immigration and Naturalization Service (MINS)
Subject: Refusal of Residence Permit Renewal (Family Reunification)

Your application for renewal of your family reunification residence permit with your sponsor, Mr. J. Rostova, is REFUSED.

Under Article 147(1) of the Immigration and Residency Code of Mars, the sponsor must demonstrate independent net monthly income of at least 120% of the social minimum wage (2,160 MC). According to the submitted tax documents, your sponsor's current income is 1,950 MC, which falls below the statutory threshold. Furthermore, Article 115 stipulates a 5-year probationary period, and since you have only resided here for 3 years, you do not yet qualify for an independent permit.

You are ordered to leave Mars within 28 days.`,
        appealText: `Notice of Objection
I object to the refusal of my permit renewal. While my husband's base salary is 1,950 MC, the MINS failed to include his guaranteed annual bonus, which averages out to 300 MC per month, bringing the total to 2,250 MC (above the 2,160 MC threshold). Under the established guidelines for calculating means of subsistence, structural and guaranteed bonuses must be included. Refusing my permit over this arithmetic oversight, and breaking up our family, violates the principle of proportionality (Article 163).`
    },
    {
        appellantName: "David Chen",
        visaType: "STUDENT_VISA",
        denialText: `Decision of the Mars Immigration and Naturalization Service (MINS)
Subject: Refusal of Residence Permit Renewal (Study)

Your application for the renewal of your study permit at Mars Central University is REFUSED.

According to Article 222(2) of the Immigration and Residency Code, a student must earn at least 50% of the required academic credits per year to maintain their study permit. The university has reported that in the previous academic year, you only earned 15 out of 60 credits (25%). Consequently, the condition for academic progress is not met.

Your lawful residence is terminated.`,
        appealText: `Notice of Objection
I am appealing the withdrawal of my study permit under Art 222(2). During the last academic year, I suffered a severe and documented medical condition (mononucleosis) that hospitalized me for 6 weeks and severely limited my ability to attend lectures and complete exams. I submitted the medical certificates to the university's student counselor, but due to an administrative delay, these were not forwarded to MINS in time. The failure to earn 50% credits was due to force majeure (medical reasons), which is a recognized exception in the university's regulations.`
    },
    {
        appellantName: "Amina Al-Fayed",
        visaType: "WORK_PERMIT",
        denialText: `Decision of the MINS
Subject: Withdrawal of Residence Permit (Highly Skilled Migrant)

Your residence permit as a Highly Skilled Migrant is hereby WITHDRAWN.

Under Article 191(1), a highly skilled migrant must be employed by a recognized sponsor. On 15 March 2026, your employer (Nexus Logistics) lost its recognized sponsor status following a compliance audit under Article 189. Because your sponsor is no longer recognized, the basis for your residence permit has ceased to exist under Article 132(2)(a). 
You must depart Mars within 28 days.`,
        appealText: `Notice of Objection
I am objecting to the immediate withdrawal of my permit. I was entirely unaware of my employer's compliance issues and have worked diligently. Article 198(1) of the Code states that a foreign national who loses employment retains their residence permit for 3 months to seek new employment. The withdrawal of my employer's status effectively resulted in the loss of my qualifying employment through no fault of my own. I should be granted the statutory 3-month search period to find a new recognized sponsor before my permit is revoked.`
    },
    {
        appellantName: "Marcus Thorne",
        visaType: "NATURALIZATION", // Will be mapped to OTHER or stay as NATURALIZATION
        denialText: `Decision of the MINS
Subject: Refusal of Permanent Residence

Your application for a Permanent Residence (PR) permit is REFUSED.

Article 282(1) of the Immigration and Residency Code requires 5 years of continuous residence, defined physically as no absences exceeding 6 consecutive months or 10 months total within the 5-year period. Travel records show you were absent from Mars from 10 January 2024 to 20 August 2024 (over 7 continuous months). Because the continuity of your residence is broken, you are not eligible for PR.`,
        appealText: `Notice of Objection
I appeal the refusal of my PR application. My 7-month absence was solely because my Martian employer temporarily assigned me to oversee the opening of our earth branch. Article 282(2) explicitly states that absences for employment assignments abroad do not interrupt continuity if a retention declaration (Art. 133) was obtained. I applied for and received this retention declaration on 5 January 2024, prior to my departure. Therefore, my residence remains legally continuous.`
    },
    {
        appellantName: "Sarah Jenkins",
        visaType: "SHORT_STAY",
        denialText: `Decision of the MINS
Subject: Refusal of Short-Stay Visa Extension

Your application to extend your Type B Tourism short-stay visa beyond the 90-day limit is REFUSED.

Under Article 40 of the Code, a short stay may only be extended beyond 90 days under exceptional circumstances (force majeure, humanitarian, or serious medical reasons). Your stated reason for extension—wanting to spend more time travelling the northern hemisphere—does not constitute an exceptional circumstance.
You must leave Mars before your visa expires tomorrow.`,
        appealText: `Notice of Objection
I object to the refusal. While my original intent was tourism, I submitted a doctor's note explicitly stating I contracted a severe upper respiratory infection that renders me temporarily unfit to fly. This falls squarely under "serious medical reasons" (Art 40(c) and Art 85(4)). I am not asking to stay indefinitely, merely an extension of 10 days to recover so I am medically cleared to board a commercial flight. Dismissing this as mere "tourism" ignores the medical evidence provided.`
    },
    {
        appellantName: "Hassan Oumar",
        visaType: "ASYLUM",
        denialText: `Decision of the MINS
Subject: Rejection of Asylum Application

Your application for international protection (refugee status/subsidiary protection) is REJECTED.

While the MINS accepts your account that you face persecution from local militias in the eastern province of your home country, we find that you have a viable Internal Flight Alternative under Article 253. The capital city of your home country is firmly under government control and the militia does not operate there. Access to the capital is safe, and you are a young, healthy man capable of establishing yourself there. Therefore, international protection in Mars is not necessary.`,
        appealText: `Notice of Objection
I appeal the rejection based on Article 253. The MINS assessment that the capital is an "Internal Flight Alternative" is flawed. First, the capital is 1,200 kilometers away and the only roads passing through are controlled by the very militia I am fleeing. Therefore, access to the area is NOT safe and legal (Art. 253(a)). Second, recent UNHCR reports from last month document that agents of this militia have begun assassinating dissidents in the capital itself. The protection of the state is illusory.`
    },
    {
        appellantName: "Isabella Martinez",
        visaType: "OTHER",
        denialText: `Decision of the MINS
Subject: Refusal of Start-up Visa Extension

Your application to convert your 1-year start-up visa into a regular self-employment authorization under Article 207 is REFUSED.

Under Article 208(2), the start-up visa may be extended to a regular permit only upon demonstrating business viability. The financial records show your company has generated less than 2,000 MC in revenue over the past 12 months and you have exhausted your initial funding. The business plan is not deemed financially sustainable, and you lack the sufficient financial means specified in Article 207(1).`,
        appealText: `Notice of Objection
I am appealing the refusal of my self-employment authorization. The MINS strictly looked at past revenue without considering the business model. My company spent the first 11 months developing a deep-tech software platform, which naturally generated no revenue during R&D. However, as demonstrated in my application index Annex B, we just signed a B2B licensing contract worth 45,000 MC annually, starting next month. This clearly demonstrates business viability and future financial sustainability under Art 207.`
    },
    {
        appellantName: "Omar & Fatima Khalid",
        visaType: "FAMILY_REUNIFICATION",
        denialText: `Decision of the MINS
Subject: Refusal of Residence Permit (Family Reunification)

Your application for family reunification is REFUSED.

Pursuant to Article 162 (Marriage of Convenience), the competent authority has concluded that your marriage was established primarily to obtain residence. This conclusion is based on several indicators: there is a 20-year age gap between the sponsor and the applicant, you do not share a common language, and during the interviews, you gave conflicting answers regarding how you met. Consequently, the family relationship is not deemed genuine.`,
        appealText: `Notice of Objection
We object to the characterization of our marriage as one of convenience. First, arranged marriages are a deeply rooted cultural tradition in our home country, spanning generations, which explains the age gap and how we met (arranged by respective uncles, hence our slight confusion on dates of 'first meeting' versus 'agreement'). Second, we communicate perfectly in Arabic; the MINS interviewer wrongly assumed we couldn't communicate because neither of us spoke fluent English. Article 162(3) states no single indicator is determinative, and MINS ignored our 3 years of daily chat logs and financial remittances.`
    },
    {
        appellantName: "Dmitri Volkov",
        visaType: "OTHER",
        denialText: `Decision of the MINS
Subject: Refusal of Residence Permit (Medical Treatment)

Your application for a residence permit for medical treatment under Article 109 is REFUSED.

Article 109(1) stipulates that a medical treatment permit may only be granted if the treatment is not available in the applicant's country of origin. According to the medical advisory report, the oncological treatment you seek at Mars General Hospital is, in fact, available in leading hospitals in your home country. Consequently, your residence in Mars for this purpose is not strictly necessary.`,
        appealText: `Notice of Objection
I appeal the refusal. While standard chemotherapy is available in my home country, the specific experimental targeted proton therapy I am enrolled in is part of a clinical trial run EXCLUSIVELY by the Martian Oncology Institute. The medical advisory report mistakenly generalized my condition without reading the letter from Dr. Vance (the principal investigator), which explicitly confirms this particular, life-saving trial is unavailable anywhere else. Refusing this permit would critically interrupt my medical care (Art 276).`
    },
    {
        appellantName: "Luiz Silva",
        visaType: "WORK_PERMIT",
        denialText: `Decision of the MINS
Subject: Non-Renewal of Residence Permit

Your application for the renewal of your employment residence permit is REFUSED.

Under Article 101(1) of the Immigration and Residency Code, a foreign national must pass the civic integration examination within 3 years of permit issuance. Our records indicate exactly 3 years and 1 month have passed since your initial permit was issued, and you have not submitted proof of passing the civic integration exam. Therefore, under Article 132(2)(c), your permit is not renewed.`,
        appealText: `Notice of Objection
I object to the non-renewal. While I have not passed the A2 level exam, I am exempt from the civic integration requirement under Article 102(b) because I hold an academic degree recognized in Mars. I submitted a certified copy of my Master's Degree in Engineering from the Mars Institute of Technology with my original application three years ago. It appears the MINS overlooked this exemption and wrongfully applied Article 132(2)(c).`
    }
];

async function seed() {
    console.log('Seeding 10 demo cases into the AppealAI pipeline...');

    // We process them via the batch endpoint which was built exactly for this
    try {
        const response = await fetch('http://localhost:3000/api/appeal-ai/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cases })
        });

        const data = await response.json();
        if (data.success) {
            console.log('Successfully processed batch!');
            console.log('Cases generated:', data.results.length);
            console.log('Now extracting arguments and generating drafts for each (this runs in background in the app, but we want it done now)...');

            // Let's trigger argument extraction and draft generation for these cases so the dashboard is FULLY populated
            for (const result of data.results) {
                if (result.caseId) {
                    console.log("\\nProcessing Case " + result.caseNumber + "...");

                    // 1. Extract citations
                    await fetch('http://localhost:3000/api/appeal-ai/citations', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ caseId: result.caseId })
                    });
                    console.log("  - Citations extracted");

                    // 2. Predict outcome
                    await fetch('http://localhost:3000/api/appeal-ai/predict', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ caseId: result.caseId })
                    });
                    console.log("  - Outcome predicted");

                    // 3. Extract arguments
                    const argsRes = await fetch('http://localhost:3000/api/appeal-ai/arguments', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ caseId: result.caseId })
                    });
                    const argsData = await argsRes.json();
                    console.log("  - Arguments extracted (" + (argsData.arguments?.length || 0) + ")");

                    // 4. Generate drafts (agentic retrieval)
                    console.log("  - Generating drafts (this takes a moment due to LLM)...");
                    const draftsRes = await fetch('http://localhost:3000/api/appeal-ai/drafts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ caseId: result.caseId })
                    });
                    const draftsData = await draftsRes.json();
                    console.log("  - Drafts generated: " + (draftsData.success ? 'Success' : 'Failed'));
                }
            }

            console.log('\\nAll 10 demo cases have been completely processed through ALL AI pipelines!');
        } else {
            console.error('Batch processing failed:', data);
        }
    } catch (err) {
        console.error('Error hitting the API:', err);
    }
}

seed();

# Case Presentation Component Data Structures

This document outlines the prop interfaces and data structures for the four case presentation components in the Nyaya AI Frontend: CaseSummaryCard, LegalRouteCard, TimelineCard, and GlossaryCard. Each component is designed to accept structured API responses as props, ensuring consistent data flow from the backend.

## CaseSummaryCard

Displays case overview, key facts, jurisdiction, confidence level, and summary analysis.

### Prop Interface

```typescript
interface CaseSummaryCardProps {
  caseId: string;
  title: string;
  overview: string;
  keyFacts: string[];
  jurisdiction: string;
  confidence: number; // 0.0 to 1.0
  summaryAnalysis: string;
  dateFiled?: string;
  status?: string;
  parties?: {
    plaintiff?: string;
    defendant?: string;
  };
}
```

### Example Data

```json
{
  "caseId": "CASE-2024-001",
  "title": "Breach of Contract Dispute - Software Development Services",
  "overview": "A dispute arising from alleged non-performance of software development services under a fixed-price contract valued at INR 2,500,000.",
  "keyFacts": [
    "Contract signed on 15th March 2024 with delivery deadline of 30th June 2024",
    "Plaintiff alleges incomplete delivery and poor quality of deliverables",
    "Defendant claims force majeure due to COVID-19 related restrictions",
    "Multiple email communications and project management records available"
  ],
  "jurisdiction": "India",
  "confidence": 0.87,
  "summaryAnalysis": "This appears to be a straightforward breach of contract case under Indian law. The Indian Contract Act, 1872, and relevant provisions of the Specific Relief Act, 1963, would govern the dispute. Key considerations include force majeure clauses, limitation periods, and availability of specific performance as a remedy.",
  "dateFiled": "2024-07-15",
  "status": "Pre-litigation",
  "parties": {
    "plaintiff": "TechSolutions Pvt Ltd",
    "defendant": "DevCorp India"
  }
}
```

## LegalRouteCard

Shows available legal pathways or routes (litigation, mediation, arbitration, etc.) with descriptions and recommendations.

### Prop Interface

```typescript
interface LegalRoute {
  name: string;
  description: string;
  recommendation: string;
  suitability: number; // 0.0 to 1.0
  estimatedDuration?: string;
  estimatedCost?: string;
  pros?: string[];
  cons?: string[];
}

interface LegalRouteCardProps {
  routes: LegalRoute[];
  jurisdiction: string;
  caseType: string;
}
```

### Example Data

```json
{
  "routes": [
    {
      "name": "Mediation",
      "description": "Non-binding dispute resolution through a neutral third-party mediator who facilitates negotiation between parties.",
      "recommendation": "Highly recommended as first step due to lower cost and faster resolution. Suitable for commercial disputes where relationship preservation is important.",
      "suitability": 0.95,
      "estimatedDuration": "2-4 weeks",
      "estimatedCost": "INR 50,000-100,000",
      "pros": [
        "Confidential process",
        "Preserves business relationships",
        "Lower cost than litigation",
        "Flexible outcomes"
      ],
      "cons": [
        "Non-binding nature",
        "Requires mutual agreement to participate"
      ]
    },
    {
      "name": "Arbitration",
      "description": "Binding dispute resolution through private arbitration tribunal, often faster than court litigation.",
      "recommendation": "Strong alternative to litigation for commercial contracts. Consider if contract contains arbitration clause.",
      "suitability": 0.85,
      "estimatedDuration": "3-6 months",
      "estimatedCost": "INR 200,000-500,000",
      "pros": [
        "Binding decision",
        "Expert arbitrators in technical fields",
        "Confidential proceedings",
        "Enforceable under New York Convention"
      ],
      "cons": [
        "Limited appeal options",
        "May still be costly for small claims"
      ]
    },
    {
      "name": "Civil Litigation",
      "description": "Formal court proceedings through the Indian civil court system, including district courts and high courts.",
      "recommendation": "Consider only after exhausting ADR options. Suitable when specific performance or injunction is required.",
      "suitability": 0.60,
      "estimatedDuration": "1-3 years",
      "estimatedCost": "INR 300,000-1,000,000+",
      "pros": [
        "Binding court judgment",
        "Right to appeal",
        "Public record",
        "Wide range of remedies available"
      ],
      "cons": [
        "Lengthy process",
        "High costs",
        "Public nature may damage reputation",
        "Court backlog in India"
      ]
    }
  ],
  "jurisdiction": "India",
  "caseType": "Commercial Contract Dispute"
}
```

## TimelineCard

Presents chronological events, deadlines, or procedural steps.

### Prop Interface

```typescript
interface TimelineEvent {
  id: string;
  date: string; // ISO date string
  title: string;
  description: string;
  type: 'event' | 'deadline' | 'milestone' | 'step';
  status?: 'completed' | 'pending' | 'overdue';
  documents?: string[];
  parties?: string[];
}

interface TimelineCardProps {
  events: TimelineEvent[];
  jurisdiction: string;
  caseId: string;
}
```

### Example Data

```json
{
  "events": [
    {
      "id": "contract-signing",
      "date": "2024-03-15",
      "title": "Contract Signing",
      "description": "Fixed-price software development contract signed between TechSolutions Pvt Ltd and DevCorp India for INR 2,500,000.",
      "type": "milestone",
      "status": "completed",
      "documents": ["Contract_Agreement_2024.pdf"],
      "parties": ["TechSolutions Pvt Ltd", "DevCorp India"]
    },
    {
      "id": "project-deadline",
      "date": "2024-06-30",
      "title": "Project Delivery Deadline",
      "description": "Original deadline for project completion as per contract terms.",
      "type": "deadline",
      "status": "completed",
      "documents": ["Project_Scope_Document.pdf"]
    },
    {
      "id": "delay-notification",
      "date": "2024-07-05",
      "title": "Delay Notification",
      "description": "TechSolutions notified DevCorp of project delays and quality issues via email.",
      "type": "event",
      "status": "completed",
      "documents": ["Delay_Notice_Email_2024.pdf"]
    },
    {
      "id": "force-majeure-claim",
      "date": "2024-07-10",
      "title": "Force Majeure Claim",
      "description": "DevCorp invoked force majeure clause citing COVID-19 restrictions affecting development team.",
      "type": "event",
      "status": "completed",
      "documents": ["Force_Majeure_Notice.pdf"]
    },
    {
      "id": "mediation-request",
      "date": "2024-07-15",
      "title": "Mediation Request",
      "description": "Formal request for mediation filed with Indian Institute of Arbitration and Mediation.",
      "type": "step",
      "status": "pending",
      "documents": ["Mediation_Request_Form.pdf"]
    },
    {
      "id": "limitation-deadline",
      "date": "2025-06-30",
      "title": "Limitation Period Expires",
      "description": "Three-year limitation period under Indian Limitation Act, 1963, for contract disputes.",
      "type": "deadline",
      "status": "pending"
    }
  ],
  "jurisdiction": "India",
  "caseId": "CASE-2024-001"
}
```

## GlossaryCard

Defines legal terms and jargon used in the case.

### Prop Interface

```typescript
interface GlossaryTerm {
  term: string;
  definition: string;
  context?: string;
  relatedTerms?: string[];
  jurisdiction?: string;
}

interface GlossaryCardProps {
  terms: GlossaryTerm[];
  jurisdiction: string;
  caseType?: string;
}
```

### Example Data

```json
{
  "terms": [
    {
      "term": "Breach of Contract",
      "definition": "Violation of any term or condition of a contract without lawful excuse. Under Indian law, breach occurs when a party fails to perform their obligations as stipulated in the agreement.",
      "context": "The plaintiff alleges that the defendant committed breach by failing to deliver the software within the agreed timeframe and to the specified quality standards.",
      "relatedTerms": ["Material Breach", "Anticipatory Breach", "Remedies for Breach"],
      "jurisdiction": "India"
    },
    {
      "term": "Force Majeure",
      "definition": "A clause in contracts that frees both parties from liability or obligation when an extraordinary event or circumstance beyond their control occurs, such as natural disasters, wars, or pandemics.",
      "context": "The defendant has invoked the force majeure clause citing COVID-19 restrictions as preventing timely project completion.",
      "relatedTerms": ["Act of God", "Frustration of Contract"],
      "jurisdiction": "India"
    },
    {
      "term": "Specific Performance",
      "definition": "A court-ordered remedy requiring a party to perform their contractual obligations exactly as agreed, rather than paying damages. Available under Section 10 of the Specific Relief Act, 1963.",
      "context": "The plaintiff may seek specific performance to compel the defendant to complete the software development work.",
      "relatedTerms": ["Injunction", "Damages", "Quantum Meruit"],
      "jurisdiction": "India"
    },
    {
      "term": "Limitation Period",
      "definition": "The maximum time period within which a legal action must be initiated after the cause of action arises. For contract disputes in India, this is generally three years under Article 55 of the Limitation Act, 1963.",
      "context": "The limitation period for this contract dispute began from the date of the alleged breach (June 30, 2024) and will expire on June 30, 2027.",
      "relatedTerms": ["Cause of Action", "Statute of Limitations"],
      "jurisdiction": "India"
    },
    {
      "term": "Arbitration Agreement",
      "definition": "A clause in a contract that requires disputes to be resolved through arbitration rather than litigation. Governed by the Arbitration and Conciliation Act, 1996 in India.",
      "context": "The contract contains an arbitration clause requiring disputes to be resolved through the Indian Council of Arbitration.",
      "relatedTerms": ["Arbitral Tribunal", "Arbitral Award"],
      "jurisdiction": "India"
    }
  ],
  "jurisdiction": "India",
  "caseType": "Commercial Contract Dispute"
}
```

## JurisdictionInfoBar

Displays key information about a legal jurisdiction including country, court system, authority framing, and emergency guidance.

### Prop Interface

```typescript
interface JurisdictionInfoBarProps {
  jurisdiction: JurisdictionInfo;
}

interface JurisdictionInfo {
  country: string;
  courtSystem: string;
  authorityFraming: string;
  emergencyGuidance: string;
}
```

### Example Data

#### India
```json
{
  "country": "India",
  "courtSystem": "Indian Judicial System",
  "authorityFraming": "Formal and procedural, emphasizing due process and evidence-based decisions",
  "emergencyGuidance": "File FIR at nearest Police Station, contact local magistrate for immediate orders"
}
```

#### United Kingdom
```json
{
  "country": "United Kingdom",
  "courtSystem": "UK Courts and Tribunals",
  "authorityFraming": "Adversarial system with emphasis on precedent and judicial discretion",
  "emergencyGuidance": "Contact Police (999) or Crown Prosecution Service for urgent matters"
}
```

#### United Arab Emirates
```json
{
  "country": "United Arab Emirates",
  "courtSystem": "UAE Federal Judiciary",
  "authorityFraming": "Civil law system with Islamic Sharia influences, emphasizing reconciliation",
  "emergencyGuidance": "Contact Public Prosecution or local police for immediate legal intervention"
}
```

## Implementation Notes

1. **Confidence Levels**: All components include confidence scores (0.0-1.0) to indicate AI certainty in the analysis.

2. **Jurisdiction Awareness**: Each component includes jurisdiction information to ensure context-appropriate display and terminology.

3. **Extensibility**: Prop interfaces are designed to be extensible, allowing for additional fields as the API evolves.

4. **Type Safety**: Using TypeScript interfaces ensures type safety and better developer experience.

5. **Realistic Data**: Example data is based on actual legal scenarios and Indian legal framework, making it suitable for testing and development.

6. **Modular Design**: Each component focuses on a specific aspect of case presentation, allowing for flexible UI composition.
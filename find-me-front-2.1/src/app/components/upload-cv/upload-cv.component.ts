import { Component, ElementRef, EventEmitter, Inject, Output, PLATFORM_ID, ViewChild } from '@angular/core';
import { HttpClient, HttpEventType } from '@angular/common/http';
import { FormBuilder, FormGroup } from '@angular/forms';
import { CvService } from '../../services/cv.service';
import { isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { apiRoutingServiceFlusk } from '../../services/api-routing-flusk.services';
import { AuthService } from '../../services/auth.service';
import { Cv } from '../../_model/Cv';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-upload-cv',
  templateUrl: './upload-cv.component.html',
  styleUrls: ['./upload-cv.component.scss']
})
export class UploadCvComponent {
  @ViewChild('fileInput') fileInput!: ElementRef;
  selectedFile: File | null = null;
  isLoading = false;
  errorMessage = '';
  parsedData: any = null;
  userId: number | null = null;
  idCv: number | null = null;
  uploadProgress = 0;
  private progressInterval: any;
  // @Output() activeSectionChange = new EventEmitter<string>();

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private cvService: CvService,
    @Inject(PLATFORM_ID) private platformId: object,
    private router: Router,
    private apiRoutingServiceFlusk: apiRoutingServiceFlusk
  ) {}

  ngOnInit(): void {
    this.userId = this.authService.getUserId();

    if (!this.userId) {
      console.error("❌ userId manquant dans le token !");
      return;
    }

    //console.log("✅ UserId récupéré depuis token :", this.userId);
    this.loadCv(this.userId);
  }

  loadCv(userId: number): void {
    this.cvService.getCvByUserId(userId).subscribe(cv => {
      this.idCv = cv?.id_cv ?? null;
      //console.log("🆔 CV ID:", this.idCv);
    });
  }

  onFileSelected(event: any) {
    const file: File = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  triggerFileInput() {
    this.fileInput.nativeElement.click();
  }

  saveModal() {
    if (!this.selectedFile) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.uploadProgress = 0;

    // Start progress simulation
    this.simulateProgress();

    const formData = new FormData();
    //console.log('selected file',this.selectedFile)
    formData.append('file', this.selectedFile);
    //console.log("selectedFile",this.selectedFile);
    //console.log("formData",formData);

    this.apiRoutingServiceFlusk.requestApi('/parse-cv/', formData).subscribe(
      (response: any) => {
        clearInterval(this.progressInterval);
        this.uploadProgress = 100;
        try {
          this.parsedData = this.transformResponse(response);
          this.onSave(response);
        } catch (error) {
          this.errorMessage = 'Erreur lors de l\'analyse du CV';
          this.isLoading = false;
        }
      },
      (error) => {
        clearInterval(this.progressInterval);
        console.error('Error fetching CV contenu:', error);
        this.isLoading = false;
        this.errorMessage = 'Une erreur est survenue lors du téléchargement';
      }
    );
  }

  private simulateProgress() {
    this.progressInterval = setInterval(() => {
      if (this.uploadProgress < 90) { // Don't go to 100% until complete
        this.uploadProgress += Math.floor(Math.random() * 10) + 1;
      }
    }, 500);
  }

  onSave(parsedData: any): void {
    if (!this.userId) {
      alert("❌ Erreur : userId non trouvé !");
      return;
    }

    const cvData: Cv = {
      id_cv: this.idCv ?? undefined,
      userId: this.userId,
      competences: [this.transformResponse(parsedData).competencesTechniques],
      educations: this.transformResponse(parsedData).education,
      experiences: this.transformResponse(parsedData).projets,
      langues: this.transformResponse(parsedData).langues,
    };

    this.cvService.saveCv(this.userId, cvData).subscribe(
      (response: Cv) => {
        this.isLoading = false;
        // this.activeSectionChange.emit('cvmanuelle');
        this.router.navigate(['/cv/remplir']); 

      },
      (error: any) => {
        console.error('❌ Erreur lors de la sauvegarde du CV:', error);
        this.isLoading = false;
        alert("Erreur lors de l'enregistrement du CV.");
      }
    );
  }

  private transformResponse(data: any): any {
    return {
      education: data.education?.map((edu: any) => ({
        diplome: edu.degree,
        university: edu.institution,
        dateDebut: edu.start_year,
        dateFin: edu.end_year
      })) || [],
      
      competencesTechniques: { 
        db: data.technical_skills?.databases.join(', ') || '',
        systemExploitation: data.technical_skills?.operating_systems.join(', ') || '',
        outils: data.technical_skills?.tools.join(', ') || '',
        languageProgrammation: data.technical_skills?.programming_languages.join(', ') || '',
        framework: data.technical_skills?.frameworks.join(', ') || '',
        api: data.technical_skills?.apis.join(', ') || '',
        architechture: data.technical_skills?.architectures.join(', ') || '',
        conception: data.technical_skills?.design.join(', ') || '',
        designPattern: data.technical_skills?.design_patterns.join(', ') || '',
        bibliotheque: data.technical_skills?.libraries.join(', ') || '',
        langageBallsage: data.technical_skills?.markup_languages.join(', ') || '',
        methodologie: data.technical_skills?.methodologies.join(', ') || '',
      },
      
      langues: data.languages?.map((lang: any) => ({
        name: lang.language,
        niveau: lang.proficiency
      })) || [],
      
      projets: data.projects?.map((proj: any) => ({
        nomProjet: proj.title,
        client: proj.client_name,
        entreprise: proj.client_name,
        equipe: proj.team_composition,
        dateDebut: proj.start_year,
        dateFin: proj.end_year
      })) || []
    };
  }

  // Drag and drop methods
  isDragging = false;

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;
    
    if (event.dataTransfer && event.dataTransfer.files.length > 0) {
      const file = event.dataTransfer.files[0];
      if (file.type === 'application/pdf') {
        this.selectedFile = file;
        const fileList = new DataTransfer();
        fileList.items.add(file);
        
        const changeEvent = {
          target: {
            files: fileList.files
          }
        };
        
        this.onFileSelected(changeEvent);
      } else {
        this.errorMessage = 'Seuls les fichiers PDF sont acceptés.';
      }
    }
  }

  removeFile() {
    this.selectedFile = null;
    this.errorMessage = '';
    if (this.fileInput && this.fileInput.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }
}
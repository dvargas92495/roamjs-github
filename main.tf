terraform {
  backend "remote" {
    hostname = "app.terraform.io"
    organization = "VargasArts"
    workspaces {
      prefix = "roamjs-github"
    }
  }
  required_providers {
    github = {
      source = "integrations/github"
      version = "4.2.0"
    }
  }
}

variable "aws_access_token" {
  type = string
}

variable "aws_secret_token" {
  type = string
}

variable "developer_token" {
  type = string
}

variable "github_token" {
  type = string
}

provider "aws" {
  region = "us-east-1"
  access_key = var.aws_access_token
  secret_key = var.aws_secret_token
}

provider "github" {
    owner = "dvargas92495"
    token = var.github_token
}

module "roamjs_lambda" {
  source = "dvargas92495/lambda/roamjs"
  providers = {
    aws = aws
    github = github
  }

  name = "github"
  lambdas = [
    { 
      path = "github-cards", 
      method = "get"
    },
    { 
      path = "github-issues", 
      method = "get"
    },
    { 
      path = "github-projects", 
      method = "get"
    },
    { 
      path = "github-repositories", 
      method = "get"
    },
  ]
  aws_access_token = var.aws_access_token
  aws_secret_token = var.aws_secret_token
  github_token     = var.github_token
  developer_token  = var.developer_token
}
